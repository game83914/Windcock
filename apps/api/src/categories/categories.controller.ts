import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { CapabilityGuard } from '../identity/capability.guard';
import { RequiresCapability } from '../identity/capability.decorator';
import { Capability } from '../identity/policy.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { CategoriesService } from './categories.service';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  list() {
    return this.categories.list();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), CapabilityGuard)
  @RequiresCapability(Capability.CATEGORY_MANAGE)
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':key')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), CapabilityGuard)
  @RequiresCapability(Capability.CATEGORY_MANAGE)
  update(@Param('key') key: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(key, dto);
  }

  @Delete(':key')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), CapabilityGuard)
  @RequiresCapability(Capability.CATEGORY_MANAGE)
  remove(@Param('key') key: string) {
    return this.categories.remove(key);
  }
}