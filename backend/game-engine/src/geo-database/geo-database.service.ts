import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export interface GeoLocation {
  id: string;
  lat: number;
  lng: number;
  label: string;
  country: string;
  region: string;
  difficulty: string;
}

@Injectable()
export class GeoDatabaseService implements OnModuleInit {
  private readonly logger = new Logger(GeoDatabaseService.name);
  private pool: Pool | null = null;
  private inMemoryLocations: GeoLocation[] = [];

  onModuleInit() {
    this.loadInMemoryLocations();
    this.initPostgresConnection();
  }

  private loadInMemoryLocations() {
    const candidates = [
      path.join(process.cwd(), 'data', 'locations.json'),
      path.join(__dirname, '..', '..', 'data', 'locations.json'),
      path.join(process.cwd(), '..', 'data', 'locations.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        try {
          const raw = fs.readFileSync(p, 'utf-8');
          this.inMemoryLocations = JSON.parse(raw);
          this.logger.log(`In-memory locations loaded: ${this.inMemoryLocations.length}`);
          return;
        } catch (e: any) {
          this.logger.warn(`Failed reading ${p}: ${e.message}`);
        }
      }
    }
  }

  private async initPostgresConnection() {
    const connStr =
      process.env.DATABASE_URL ||
      'postgres://geoguessr:geopassword@127.0.0.1:5432/geodb';

    try {
      this.pool = new Pool({
        connectionString: connStr,
        connectionTimeoutMillis: 3000,
      });
      const res = await this.pool.query('SELECT COUNT(*) FROM locations');
      this.logger.log(`Connected to PostGIS! Table contains ${res.rows[0].count} locations.`);
    } catch (err: any) {
      this.logger.warn(`PostGIS unavailable (${err.message}). Using in-memory dataset.`);
      this.pool = null;
    }
  }

  async getLocations(options: { region?: string; difficulty?: string }): Promise<GeoLocation[]> {
    const { region = 'all', difficulty = 'all' } = options;

    if (this.pool) {
      try {
        const conditions: string[] = [];
        const params: any[] = [];
        let idx = 1;

        if (region && region !== 'all') {
          conditions.push(`LOWER(region) = $${idx++}`);
          params.push(region.toLowerCase());
        }
        if (difficulty && difficulty !== 'all') {
          conditions.push(`LOWER(difficulty) = $${idx++}`);
          params.push(difficulty.toLowerCase());
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const query = `SELECT id, lat, lng, label, country, region, difficulty FROM locations ${whereClause}`;
        const res = await this.pool.query(query, params);
        if (res.rows && res.rows.length > 0) return res.rows;
      } catch (e: any) {
        this.logger.warn(`PostGIS query error: ${e.message}`);
      }
    }

    return this.inMemoryLocations.filter((loc) => {
      const matchRegion =
        region === 'all' || loc.region?.toLowerCase() === region.toLowerCase();
      const matchDiff =
        difficulty === 'all' || loc.difficulty?.toLowerCase() === difficulty.toLowerCase();
      return matchRegion && matchDiff;
    });
  }

  getAllInMemoryLocations(): GeoLocation[] {
    return this.inMemoryLocations;
  }
}
