import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';
import { GeoLocation } from '../game/game.types';

@Injectable()
export class GeoDatabaseService implements OnModuleInit {
  private readonly logger = new Logger(GeoDatabaseService.name);
  private pool: Pool | null = null;
  private dbConnected = false;
  private inMemoryLocations: GeoLocation[] = [];

  onModuleInit() {
    this.loadInMemoryDataset();
    this.initDatabasePool();
  }

  private loadInMemoryDataset() {
    const candidatePaths = [
      path.join(process.cwd(), 'data', 'locations.json'),
      path.join(__dirname, '..', '..', 'data', 'locations.json'),
      path.join(__dirname, '..', 'data', 'locations.json'),
    ];

    let loaded = false;
    for (const jsonPath of candidatePaths) {
      try {
        if (fs.existsSync(jsonPath)) {
          const raw = fs.readFileSync(jsonPath, 'utf8');
          this.inMemoryLocations = JSON.parse(raw);
          this.logger.log(
            `In-memory dataset loaded from ${jsonPath}: ${this.inMemoryLocations.length} locations.`,
          );
          loaded = true;
          break;
        }
      } catch (err: any) {
        this.logger.warn(`Failed reading candidate ${jsonPath}: ${err.message}`);
      }
    }

    if (!loaded) {
      this.logger.error('No locations.json found in candidate paths!');
    }
  }

  private initDatabasePool() {
    const defaultDbUrl = 'postgres://geoguessr:geopassword@localhost:5432/geodb';
    const dbUrl =
      process.env.DATABASE_URL ||
      (process.env.GEO_DB_HOST
        ? `postgres://${process.env.GEO_DB_USER || 'geoguessr'}:${process.env.GEO_DB_PASSWORD || 'geopassword'}@${process.env.GEO_DB_HOST}:${process.env.GEO_DB_PORT || 5432}/${process.env.GEO_DB_NAME || 'geodb'}`
        : defaultDbUrl);

    if (dbUrl) {
      try {
        this.pool = new Pool({
          connectionString: dbUrl,
          connectionTimeoutMillis: 3000,
          idleTimeoutMillis: 10000,
        });

        this.pool.query('SELECT count(*) FROM locations', (err, res) => {
          if (err) {
            this.logger.log(
              `PostgreSQL container not ready or table missing (${err.message}). Using in-memory locations.`,
            );
            this.dbConnected = false;
          } else {
            this.dbConnected = true;
            this.logger.log(
              `✅ Connected to PostgreSQL/PostGIS! Table contains ${res.rows[0].count} geographical locations.`,
            );
          }
        });

        this.pool.on('error', (err) => {
          this.logger.warn(`PostgreSQL pool background warning: ${err.message}`);
          this.dbConnected = false;
        });
      } catch (err: any) {
        this.logger.log(`Database pool initialization failed: ${err.message}`);
        this.dbConnected = false;
      }
    }
  }

  async getLocations(options: { region?: string; difficulty?: string } = {}): Promise<GeoLocation[]> {
    const region = (options.region || 'all').toLowerCase();
    const difficulty = (options.difficulty || 'all').toLowerCase();

    // Try PostgreSQL if connected
    if (this.dbConnected && this.pool) {
      try {
        let query = 'SELECT lat, lng, label, country, region, difficulty FROM locations WHERE 1=1';
        const params: any[] = [];

        if (region !== 'all') {
          params.push(region);
          query += ` AND region = $${params.length}`;
        }
        if (difficulty !== 'all') {
          params.push(difficulty);
          query += ` AND difficulty = $${params.length}`;
        }

        const res = await this.pool.query(query, params);
        if (res && res.rows && res.rows.length > 0) {
          return res.rows.map((r) => ({
            lat: parseFloat(r.lat),
            lng: parseFloat(r.lng),
            label: r.label,
            country: r.country,
            region: r.region,
            difficulty: r.difficulty,
          }));
        }
      } catch (err: any) {
        this.logger.warn(`Query to database failed, falling back to in-memory: ${err.message}`);
      }
    }

    // Fast in-memory filter
    return this.inMemoryLocations.filter((loc) => {
      const matchRegion = region === 'all' || loc.region === region;
      const matchDiff = difficulty === 'all' || (loc.difficulty && loc.difficulty === difficulty);
      return matchRegion && matchDiff;
    });
  }

  getAllInMemoryLocations(): GeoLocation[] {
    return this.inMemoryLocations;
  }

  isDbConnected(): boolean {
    return this.dbConnected;
  }

  getPool(): Pool | null {
    return this.pool;
  }
}
