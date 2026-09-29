import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompaniesController } from './companies.controller.js';
import { Company } from './company.entity.js';
import { CompanyRelationship } from './relationship.entity.js';
import { CompaniesService } from './companies.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyRelationship])],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
