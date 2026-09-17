import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseBootstrapService } from './database-bootstrap.service';
import { databaseOptions } from './database.config';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => databaseOptions(config.get<string>('DATABASE_URL')),
    }),
  ],
  providers: [DatabaseBootstrapService],
})
export class DatabaseModule {}
