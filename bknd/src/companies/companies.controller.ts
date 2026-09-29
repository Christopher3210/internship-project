import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  findAll(@Query('name') name?: string, @Query('levels') levels?: string) {
    return this.companiesService.findAll(name, levels);
  }

  @Post()
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Patch(':companyCode')
  update(@Param('companyCode') companyCode: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(companyCode, updateCompanyDto);
  }

  @Delete(':companyCode')
  remove(@Param('companyCode') companyCode: string) {
    return this.companiesService.remove(companyCode);
  }
}
