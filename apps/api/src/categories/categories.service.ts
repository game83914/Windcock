import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] });
  }

  async create(dto: CreateCategoryDto) {
    const exists = await this.prisma.category.findUnique({ where: { key: dto.key }, select: { key: true } });
    if (exists) throw new ConflictException('分類 key 已存在');
    return this.prisma.category.create({ data: { ...dto, sortOrder: dto.sortOrder ?? 0 } });
  }

  async update(key: string, dto: UpdateCategoryDto) {
    await this.find(key);
    return this.prisma.category.update({ where: { key }, data: dto });
  }

  async remove(key: string) {
    const used = await this.prisma.topic.count({ where: { category: key } });
    if (used > 0) throw new ConflictException(`該分類下仍有 ${used} 個議題，請先移轉後再刪除分類。`);
    await this.find(key);
    return this.prisma.category.delete({ where: { key } });
  }

  async activeKeys(): Promise<string[]> {
    const items = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { key: true },
      orderBy: { sortOrder: 'asc' },
    });
    return items.map((item) => item.key);
  }

  async assertActiveCategory(key: string) {
    const item = await this.prisma.category.findUnique({ where: { key } });
    if (!item) throw new BadRequestException('分類不存在');
    if (!item.isActive) throw new BadRequestException('該分類已停用，請改用其他分類');
    return item;
  }

  private async find(key: string) {
    const item = await this.prisma.category.findUnique({ where: { key } });
    if (!item) throw new NotFoundException('分類不存在');
    return item;
  }
}