import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pool } from 'pg';

export interface GeoLocation {
  id: string;
  lat: number;
  lng: number;
  label: string;
  country: string;
  region: string;
  difficulty: string;
}

const REGION_ALIASES: Record<string, string> = {
  north_america: 'americas',
  south_america: 'americas',
  latin_america: 'americas',
  america: 'americas',
  algerie: 'algeria',
  dz: 'algeria',
};

export const COUNTRY_TIER_WEIGHTS: Record<string, number> = {
  // Tier 1 (weight 3.0): Large, high-diversity countries
  'United States': 3.0,
  Japan: 3.0,
  Brazil: 3.0,
  France: 3.0,
  Italy: 3.0,
  Germany: 3.0,
  Spain: 3.0,
  'United Kingdom': 3.0,
  Australia: 3.0,
  Canada: 3.0,
  Mexico: 3.0,
  Algeria: 0.05,
  Argentina: 2.5,
  India: 2.5,
  Indonesia: 2.5,
  Poland: 2.2,
  Sweden: 2.2,
  Norway: 2.2,
  Thailand: 2.2,
  'South Korea': 2.2,
  'South Africa': 2.2,
  Colombia: 2.0,
  Chile: 2.0,
  Peru: 2.0,
  Turkey: 2.0,
  // Tier 3 (weight 0.35 - 0.5): Micro-states / very small road networks
  Monaco: 0.3,
  Gibraltar: 0.3,
  'San Marino': 0.35,
  Andorra: 0.4,
  Liechtenstein: 0.4,
  Malta: 0.5,
  Jersey: 0.4,
  'Isle of Man': 0.4,
  'Faroe Islands': 0.45,
  'Åland Islands': 0.4,
  Luxembourg: 0.6,
};

// Emergency fallback in case database connection fails completely during boot
const EMERGENCY_FALLBACK_LOCATIONS: GeoLocation[] = [
  { id: '1', lat: 36.7538, lng: 3.0588, label: 'Algiers, Algeria', country: 'Algeria', region: 'algeria', difficulty: 'easy' },
  { id: '2', lat: 48.8566, lng: 2.3522, label: 'Paris, France', country: 'France', region: 'europe', difficulty: 'easy' },
  { id: '3', lat: 35.6762, lng: 139.6503, label: 'Tokyo, Japan', country: 'Japan', region: 'asia', difficulty: 'easy' },
  { id: '4', lat: 40.7128, lng: -74.006, label: 'New York, USA', country: 'United States', region: 'americas', difficulty: 'easy' },
  { id: '5', lat: -33.8688, lng: 151.2093, label: 'Sydney, Australia', country: 'Australia', region: 'oceania', difficulty: 'easy' },
];

@Injectable()
export class GeoDatabaseService implements OnModuleInit {
  private readonly logger = new Logger(GeoDatabaseService.name);
  private pool: Pool | null = null;

  async onModuleInit() {
    await this.initPostgresConnection();
  }

  normalizeRegion(region?: string): string {
    const clean = (region || 'all').toLowerCase().trim();
    return REGION_ALIASES[clean] || clean;
  }

  getCountryWeight(country: string): number {
    return COUNTRY_TIER_WEIGHTS[country] ?? 1.5;
  }

  private async initPostgresConnection() {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) {
      this.logger.warn('DATABASE_URL not configured. PostGIS connection disabled.');
      return;
    }

    try {
      this.pool = new Pool({
        connectionString: connStr,
        connectionTimeoutMillis: 5000,
        max: 10,
        idleTimeoutMillis: 30000,
      });

      const res = await this.pool.query('SELECT COUNT(*) FROM locations');
      this.logger.log(`PostGIS database active! Table contains ${res.rows[0].count} authoritative locations.`);
    } catch (err: any) {
      this.logger.error(`PostGIS connection failed (${err.message}).`);
      this.pool = null;
    }
  }

  async getLocations(options: { region?: string; difficulty?: string; limit?: number }): Promise<GeoLocation[]> {
    const region = this.normalizeRegion(options.region);
    const difficulty = (options.difficulty || 'all').toLowerCase().trim();
    const queryLimit = options.limit || 500;

    if (!this.pool) {
      await this.initPostgresConnection();
    }

    if (this.pool) {
      try {
        const rows = await this.queryDb(region, difficulty, queryLimit);
        if (rows && rows.length > 0) {
          return rows;
        }

        // Fallback 1: if requested specific difficulty yielded 0 rows, relax difficulty within same region
        if (difficulty !== 'all') {
          this.logger.debug(`Relaxing difficulty filter for region: ${region}`);
          const fallbackRows = await this.queryDb(region, 'all', queryLimit);
          if (fallbackRows && fallbackRows.length > 0) {
            return fallbackRows;
          }
        }

        // Fallback 2: relax region filter to worldwide
        if (region !== 'all') {
          this.logger.debug(`Relaxing region filter to worldwide`);
          const worldwideRows = await this.queryDb('all', 'all', queryLimit);
          if (worldwideRows && worldwideRows.length > 0) {
            return worldwideRows;
          }
        }
      } catch (e: any) {
        this.logger.warn(`PostGIS query error: ${e.message}`);
      }
    }

    this.logger.warn('Returning emergency fallback locations (database unavailable)');
    return EMERGENCY_FALLBACK_LOCATIONS;
  }

  private async queryDb(region: string, difficulty: string, limit: number): Promise<GeoLocation[]> {
    if (!this.pool) return [];

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (region && region !== 'all') {
      if (region === 'algeria') {
        conditions.push(`(LOWER(country) = 'algeria' OR LOWER(region) = 'algeria')`);
      } else if (region === 'africa') {
        conditions.push(`(LOWER(region) = 'africa' OR LOWER(country) = 'algeria')`);
      } else {
        conditions.push(`LOWER(region) = $${idx++}`);
        params.push(region);
      }
    } else {
      // In Worldwide mode, exclude Algeria from the main query pool by default so its 1,000 places don't flood the match.
      // Give it a low appearing rate (only ~2% chance of including Algeria candidate).
      if (Math.random() > 0.02) {
        conditions.push(`(LOWER(country) != 'algeria' AND LOWER(region) != 'algeria')`);
      }
    }

    if (difficulty && difficulty !== 'all') {
      conditions.push(`LOWER(difficulty) = $${idx++}`);
      params.push(difficulty);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT id, lat, lng, label, country, region, difficulty 
      FROM locations 
      ${whereClause} 
      ORDER BY RANDOM() 
      LIMIT ${Number(limit) || 500}
    `;

    const res = await this.pool.query(query, params);
    return res.rows.map((r: any) => ({
      id: String(r.id),
      lat: Number(r.lat),
      lng: Number(r.lng),
      label: r.label,
      country: r.country,
      region: r.region,
      difficulty: r.difficulty,
    }));
  }

  // Deprecated stub for backwards compatibility, returns empty array
  getAllInMemoryLocations(): GeoLocation[] {
    return [];
  }
}
