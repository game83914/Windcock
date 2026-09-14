import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class ParsedIdPipe implements PipeTransform<string, bigint> {
  transform(value: string, _metadata: ArgumentMetadata): bigint {
    if (value === undefined || value === null || value === '') {
      throw new BadRequestException('缺少 ID');
    }
    if (!/^\d+$/.test(value)) {
      throw new BadRequestException('ID 必須為正整數');
    }
    return BigInt(value);
  }
}
