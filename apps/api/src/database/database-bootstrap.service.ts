import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { seedDatabase } from './seed-data';

@Injectable()
export class DatabaseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseBootstrapService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get<string>('AUTO_DB_BOOTSTRAP')?.toLowerCase() === 'false') {
      this.logger.log('Automatic migrations and seed are disabled');
      return;
    }

    const migrations = await this.dataSource.runMigrations({ transaction: 'all' });
    const seeded = await seedDatabase(this.dataSource);
    this.logger.log(
      `Database ready: ${migrations.length} migration(s), ${seeded.courses} courses, ${seeded.students} students, ${seeded.enrollments} enrollments`,
    );
  }
}
