import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CompaniesService } from './companies.service.js';
import { CompanyListResponseDto, CompanyResponseDto, DeleteCompanyResponseDto } from './dto/company-response.dto.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@ApiTags('companies')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'List companies with optional filters and pagination' })
  @ApiQuery({ name: 'name', required: false, type: String, description: 'Partial, case-insensitive company name match' })
  @ApiQuery({ name: 'levels', required: false, type: String, example: '1,2', description: 'Comma-separated company levels (1–4)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Page number; defaults to 1' })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 20, description: 'Items per page; defaults to 20 and is capped at 100' })
  @ApiOkResponse({ description: 'Paginated company results', type: CompanyListResponseDto })
  findAll(
    @Query('name') name?: string,
    @Query('levels') levels?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.companiesService.findAll(name, levels, page, pageSize);
  }

  @Post()
  @ApiOperation({ summary: 'Create a company' })
  @ApiCreatedResponse({ description: 'Company created', type: CompanyResponseDto })
  @ApiBadRequestResponse({ description: 'Request body validation failed' })
  @ApiConflictResponse({ description: 'Company code already exists' })
  create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Patch(':companyCode')
  @ApiOperation({ summary: 'Update a company' })
  @ApiParam({ name: 'companyCode', description: 'Company code to update', example: 'C01' })
  @ApiOkResponse({ description: 'Updated company', type: CompanyResponseDto })
  @ApiBadRequestResponse({ description: 'Request body validation failed' })
  @ApiNotFoundResponse({ description: 'Company was not found' })
  update(@Param('companyCode') companyCode: string, @Body() updateCompanyDto: UpdateCompanyDto) {
    return this.companiesService.update(companyCode, updateCompanyDto);
  }

  @Delete(':companyCode')
  @ApiOperation({ summary: 'Delete a company and its relationship record' })
  @ApiParam({ name: 'companyCode', description: 'Company code to delete', example: 'C01' })
  @ApiOkResponse({ description: 'Company deleted', type: DeleteCompanyResponseDto })
  @ApiNotFoundResponse({ description: 'Company was not found' })
  remove(@Param('companyCode') companyCode: string) {
    return this.companiesService.remove(companyCode);
  }
}
