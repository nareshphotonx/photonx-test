import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantSettingsDto } from './dto/update-tenant-settings.dto';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Create a tenant and owner super admin' })
  @ApiCreatedResponse({ description: 'Tenant onboarded successfully' })
  @ApiBody({
    type: Object,
    examples: {
      default: {
        value: {
          name: 'Acme India Pvt Ltd',
          slug: 'acme-india',
          ownerName: 'Owner Admin',
          email: 'owner@acme.com',
          password: 'OwnerPass@123',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          workWeekStart: 'MONDAY',
        },
      },
    },
  })
  createTenant(@Body() dto: CreateTenantDto): Promise<{
    tenantId: string;
    tenantSlug: string;
    ownerUserId: string;
  }> {
    return this.tenantsService.createTenant(dto);
  }

  @Get('current')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TENANTS_READ_CURRENT)
  @ApiOperation({ summary: 'Get current tenant context' })
  @ApiOkResponse({ description: 'Tenant details' })
  getCurrentTenant(@CurrentUser() user: Express.User): Promise<{
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    settings: {
      timezone: string;
      currency: string;
      workWeekStart: string;
      extras: unknown;
    } | null;
  }> {
    return this.tenantsService.getCurrentTenant(user.tenantId);
  }

  @Patch('current/settings')
  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.TENANT_SETTINGS_UPDATE)
  @ApiOperation({ summary: 'Update current tenant settings' })
  @ApiOkResponse({ description: 'Tenant settings updated' })
  updateCurrentSettings(
    @CurrentUser() user: Express.User,
    @Body() dto: UpdateTenantSettingsDto,
  ): Promise<{
    tenantId: string;
    timezone: string;
    currency: string;
    workWeekStart: string;
    extras: unknown;
  }> {
    return this.tenantsService.updateCurrentSettings(user.tenantId, user.sub, dto);
  }
}
