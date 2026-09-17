import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Enrollment } from '../database/entities/enrollment.entity';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ScopeService } from './scope.service';

@Module({
  imports: [TypeOrmModule.forFeature([Enrollment]), AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, ScopeService],
})
export class AnalyticsModule {}

