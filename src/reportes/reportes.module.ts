import { Module } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { MarcasModule } from '../marcas/marcas.module';
import { EmpleadoModule } from '../empleado/empleado.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Empleado } from '../empleado/entities/empleado.entity';
import { Feriado } from '../feriados/entities/feriado.entity';
import { Vacaciones } from 'src/vacaciones/entities/vacaciones.entity';
import { Ausencia } from 'src/ausencias/entities/ausencia.entity';
import { DetalleAsistenciaModule } from '../detalle-asistencia/detalle-asistencia.module';
import { DetalleAsistencia } from '../detalle-asistencia/entities/detalle-asistencia.entity';
import { AuditoriaTurno } from '../detalle-turno/entities/auditoria-turno.entity';
import { RegistroConexione } from '../registro_conexiones/entities/registro_conexione.entity';
import { Empresa } from '../empresas/empresas.entity';
import { AutorizaHorasExtra } from '../autoriza_horas_extras/entities/autoriza_horas_extra.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [MarcasModule, EmpleadoModule, DetalleAsistenciaModule, TypeOrmModule.forFeature([Empleado, Feriado, Vacaciones, Ausencia, DetalleAsistencia, AuditoriaTurno, RegistroConexione, Empresa, User, AutorizaHorasExtra])],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule { }
