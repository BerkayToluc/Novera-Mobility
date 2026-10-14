import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ContentService } from './content.service.js';

@ApiTags('content')
@Controller()
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('faq')
  @ApiQuery({
    name: 'audience',
    required: false,
    enum: ['INDIVIDUAL', 'CORPORATE'],
  })
  @ApiOkResponse({ description: 'Sık sorulan sorular (iki dilli)' })
  getFaq(@Query('audience') audience?: string) {
    return this.contentService.getFaq(audience);
  }

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
