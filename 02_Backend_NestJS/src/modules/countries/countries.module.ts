import { Module } from '@nestjs/common';
import { CountriesController, CountriesService } from './countries.controller';

@Module({
  controllers: [CountriesController],
  providers: [CountriesService],
  exports: [CountriesService],
})
export class CountriesModule {}
