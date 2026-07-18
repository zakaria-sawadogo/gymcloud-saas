import { Module } from '@nestjs/common';
import { ReportingService } from './reporting.service';
import { ReportPdfService } from './report-pdf.service';
import { ReportingController } from './reporting.controller';

@Module({
  controllers: [ReportingController],
  providers: [ReportingService, ReportPdfService],
  exports: [ReportingService],
})
export class ReportingModule {}
