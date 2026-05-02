import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AttachmentsService } from './attachments.service';
import { ConfirmUploadDto } from './dto/confirm-upload.dto';
import { CreatePresignedUrlDto } from './dto/create-presigned-url.dto';

@ApiTags('Attachments')
@ApiBearerAuth()
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post('presigned-url')
  @RequirePermissions(PERMISSIONS.ATTACHMENTS_PRESIGNED_URL)
  @ApiOperation({ summary: 'Create S3 presigned upload URL for task attachment' })
  @ApiBody({ type: CreatePresignedUrlDto })
  @ApiCreatedResponse({ description: 'Presigned URL created' })
  createPresignedUrl(
    @CurrentUser() user: Express.User,
    @Body() dto: CreatePresignedUrlDto,
  ) {
    return this.attachmentsService.createPresignedUrl(user.tenantId, user, dto);
  }

  @Post('confirm-upload')
  @RequirePermissions(PERMISSIONS.ATTACHMENTS_CONFIRM_UPLOAD)
  @ApiOperation({ summary: 'Confirm S3 upload and persist attachment metadata' })
  @ApiBody({ type: ConfirmUploadDto })
  @ApiCreatedResponse({ description: 'Attachment persisted' })
  confirmUpload(@CurrentUser() user: Express.User, @Body() dto: ConfirmUploadDto) {
    return this.attachmentsService.confirmUpload(user.tenantId, user, dto);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.ATTACHMENTS_READ)
  @ApiOperation({ summary: 'Get attachment by id' })
  @ApiParam({ name: 'id', example: 'cuid_attachment_1' })
  @ApiOkResponse({ description: 'Attachment details' })
  getAttachment(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.attachmentsService.getAttachment(user.tenantId, user, id);
  }
}
