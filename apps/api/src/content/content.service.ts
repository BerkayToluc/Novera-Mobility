import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// GET /faq, /products, /products/:slug, /services (BACKLOG #33, openapi.yaml).
// Cevaplar iki dili birlikte taşır (ADR-17); dil seçimi ön yüzde yapılır.

export type LocalizedText = { tr: string; en: string };
export type LocalizedList = { tr: string[]; en: string[] };

@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async getProducts() {
    const products = await this.prisma.product.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return products.map((product) => this.toProduct(product));
  }

  async getProduct(slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug } });
    if (!product) {
      throw new HttpException(
        { code: 'NOT_FOUND', message: 'Product not found' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.toProduct(product);
  }

  async getServices() {
    const services = await this.prisma.service.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return services.map((service) => ({
      slug: service.slug,
      title: service.title as LocalizedText,
      summary: service.summary as LocalizedText,
      points: service.points as LocalizedList,
    }));
  }

  // sortOrder gibi iç alanlar dışarı çıkmaz; yalnızca sözleşmedeki alanlar döner.
  private toProduct(product: {
    slug: string;
    title: unknown;
    concept: unknown;
    whatYouGet: unknown;
    techBenefits: unknown;
    featured: boolean;
  }) {
    return {
      slug: product.slug,
      title: product.title as LocalizedText,
      concept: product.concept as LocalizedText,
      whatYouGet: product.whatYouGet as LocalizedText,
      techBenefits: product.techBenefits as LocalizedList,
      featured: product.featured,
    };
  }
}
