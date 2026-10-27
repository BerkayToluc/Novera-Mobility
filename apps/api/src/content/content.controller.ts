import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service.js';

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('products')
  @ApiOkResponse({ description: 'Ürün listesi (iki dilli)' })
  getProducts() {
    return this.contentService.getProducts();
  }

  @Get('products/:slug')
  @ApiOkResponse({ description: 'Ürün detayı' })
  getProduct(@Param('slug') slug: string) {
    return this.contentService.getProduct(slug);
  }

  @Get('services')
  @ApiOkResponse({ description: 'Hizmet listesi (iki dilli)' })
  getServices() {
    return this.contentService.getServices();
  }
}
