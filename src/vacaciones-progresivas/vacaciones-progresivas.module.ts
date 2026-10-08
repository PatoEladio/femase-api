import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VacacionesProgresivasService } from './vacaciones-progresivas.service';
import { VacacionesProgresivasController } from './vacaciones-progresivas.controller';
import { VacacionesProgresivas } from './entities/vacaciones-progresivas.entity';
import { Empleado } from '../empleado/entities/empleado.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VacacionesProgresivas, Empleado])],
  controllers: [VacacionesProgresivasController],
  providers: [VacacionesProgresivasService],
  exports: [VacacionesProgresivasService],
})
export class VacacionesProgresivasModule {}
