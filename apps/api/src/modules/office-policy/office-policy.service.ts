import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type CheckOfficePolicyDto } from './dto/check-office-policy.dto';
import { type CreateOfficeIpDto } from './dto/create-office-ip.dto';
import { type CreateOfficeLocationDto } from './dto/create-office-location.dto';

@Injectable()
export class OfficePolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createOfficeLocation(
    tenantId: string,
    actorId: string,
    dto: CreateOfficeLocationDto,
  ): Promise<{
    id: string;
    name: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    isActive: boolean;
  }> {
    const location = await this.prisma.officeLocation.create({
      data: {
        tenantId,
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isActive: dto.isActive ?? true,
      },
    });

    await this.auditService.log({
      tenantId,
      actorId,
      action: 'OFFICE_LOCATION_CREATE',
      entityType: 'OfficeLocation',
      entityId: location.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return {
      id: location.id,
      name: location.name,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      isActive: location.isActive,
    };
  }

  async listOfficeLocations(tenantId: string): Promise<
    Array<{
      id: string;
      name: string;
      address: string;
      latitude: number | null;
      longitude: number | null;
      isActive: boolean;
    }>
  > {
    const rows = await this.prisma.officeLocation.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.address,
      latitude: row.latitude,
      longitude: row.longitude,
      isActive: row.isActive,
    }));
  }

  async createOfficeIp(
    tenantId: string,
    actorId: string,
    dto: CreateOfficeIpDto,
  ): Promise<{ id: string; cidr: string; label: string | null; isActive: boolean }> {
    try {
      const officeIp = await this.prisma.officeIp.create({
        data: {
          tenantId,
          cidr: dto.cidr,
          label: dto.label,
          isActive: dto.isActive ?? true,
        },
      });

      await this.auditService.log({
        tenantId,
        actorId,
        action: 'OFFICE_IP_CREATE',
        entityType: 'OfficeIp',
        entityId: officeIp.id,
        metadata: dto as unknown as Record<string, unknown>,
      });

      return {
        id: officeIp.id,
        cidr: officeIp.cidr,
        label: officeIp.label,
        isActive: officeIp.isActive,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Office CIDR already exists in tenant');
      }

      throw error;
    }
  }

  async listOfficeIps(tenantId: string): Promise<
    Array<{ id: string; cidr: string; label: string | null; isActive: boolean }>
  > {
    const rows = await this.prisma.officeIp.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      cidr: row.cidr,
      label: row.label,
      isActive: row.isActive,
    }));
  }

  async checkPolicy(
    tenantId: string,
    requestIp: string | undefined,
    query: CheckOfficePolicyDto,
  ): Promise<{
    allowed: boolean;
    sourceIp: string;
    matchedRule: string | null;
  }> {
    const sourceIp = query.ip ?? requestIp;

    if (!sourceIp) {
      throw new BadRequestException('Unable to resolve source IP');
    }

    const normalizedIp = this.normalizeIp(sourceIp);

    if (!normalizedIp) {
      throw new BadRequestException('Only IPv4 addresses are supported in Phase 1');
    }

    const activeRules = await this.prisma.officeIp.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const matchedRule =
      activeRules.find((rule) => this.isIpInCidr(normalizedIp, rule.cidr)) ?? null;

    return {
      allowed: Boolean(matchedRule),
      sourceIp: normalizedIp,
      matchedRule: matchedRule?.cidr ?? null,
    };
  }

  private normalizeIp(input: string): string | null {
    const raw = input.trim();

    if (raw.includes(':')) {
      const ipv4Tail = raw.split(':').pop();
      if (ipv4Tail && this.isIpv4(ipv4Tail)) {
        return ipv4Tail;
      }
      return null;
    }

    return this.isIpv4(raw) ? raw : null;
  }

  private isIpv4(ip: string): boolean {
    const parts = ip.split('.');

    if (parts.length !== 4) {
      return false;
    }

    return parts.every((part) => {
      const num = Number(part);
      return Number.isInteger(num) && num >= 0 && num <= 255;
    });
  }

  private isIpInCidr(ip: string, cidr: string): boolean {
    if (!cidr.includes('/')) {
      return ip === cidr;
    }

    const [baseIp, maskStr] = cidr.split('/');
    const maskBits = Number(maskStr);

    if (!baseIp || !this.isIpv4(baseIp) || !Number.isInteger(maskBits) || maskBits < 0 || maskBits > 32) {
      return false;
    }

    const ipNum = this.ipv4ToInt(ip);
    const baseNum = this.ipv4ToInt(baseIp);
    const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;

    return (ipNum & mask) === (baseNum & mask);
  }

  private ipv4ToInt(ip: string): number {
    return ip
      .split('.')
      .map((part) => Number(part))
      .reduce((acc, num) => (acc << 8) + num, 0) >>> 0;
  }
}
