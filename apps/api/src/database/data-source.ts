import 'reflect-metadata';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { databaseOptions } from './database.config';

ConfigModule.forRoot({ envFilePath: [resolve(__dirname, '../../../../.env')] });

const AppDataSource = new DataSource(databaseOptions());

export default AppDataSource;
