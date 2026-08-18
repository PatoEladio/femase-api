import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailerModule } from '@nestjs-modules/mailer';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { MenusModule } from './menus/menus.module';
import { PerfilesModule } from './perfiles/perfiles.module';
import { EmpresasModule } from './empresas/empresas.module';
import { DepartamentosModule } from './departamentos/departamentos.module';
import { CencosModule } from './cencos/cencos.module';
import { DispositivoModule } from './dispositivo/dispositivo.module';
import { TipoDispositivoModule } from './tipo-dispositivo/tipo-dispositivo.module';
import { CargosModule } from './cargos/cargos.module';
import { TurnoModule } from './turno/turno.module';
import { HorarioModule } from './horario/horario.module';
import { EmpleadoModule } from './empleado/empleado.module';
import { AfpModule } from './afp/afp.module';
import { ErrorRechazoModule } from './error-rechazo/error-rechazo.module';
import { ProveedorCorreoModule } from './proveedor-correo/proveedor-correo.module';
import { FeriadosModule } from './feriados/feriados.module';
import { TipoAusenciaModule } from './tipo-ausencia/tipo-ausencia.module';
import { SesionActivaModule } from './sesion-activa/sesion-activa.module';
import { DetalleTurnoModule } from './detalle-turno/detalle-turno.module';
import { SemanaModule } from './semana/semana.module';
import { TipoMarcasModule } from './tipo-marcas/tipo-marcas.module';
import { AsignacionTurnoRotativoModule } from './asignacion_turno_rotativo/asignacion_turno_rotativo.module';
import { MarcasModule } from './marcas/marcas.module';
import { MarcasAuditoriaModule } from './marcas-auditoria/marcas-auditoria.module';
import { ReportesModule } from './reportes/reportes.module';
import { VacacionesModule } from './vacaciones/vacaciones.module';
import { AusenciasModule } from './ausencias/ausencias.module';
import { AutorizaHorasExtrasModule } from './autoriza_horas_extras/autoriza_horas_extras.module';
import { RegistroEventoModule } from './registro_evento/registro_evento.module';
import { DetalleAsistenciaModule } from './detalle-asistencia/detalle-asistencia.module';
import { AlertasModule } from './alertas/alertas.module';
import { TeletrabajoModule } from './teletrabajo/teletrabajo.module';
import { HorasLegalesModule } from './horas_legales/horas_legales.module';
import { DocumentoModule } from './documento/documento.module';
import { FirmasModule } from './firmas/firmas.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { RegistroConexionesModule } from './registro_conexiones/registro_conexiones.module';
import { HorasCompensacionModule } from './horas_compensacion/horas_compensacion.module';
import { SolicitudHorasCompensacionModule } from './solicitud_horas_compensacion/solicitud_horas_compensacion.module';
import { HuellasModule } from './huellas/huellas.module';
import { TareasHuellasModule } from './tareas-huellas/tareas-huellas.module';

import { User } from './users/user.entity';
import { Perfil } from './perfiles/perfil.entity';
import { Estado } from './estado/estado.entity';
import { Menu } from './menus/menus.entity';
import { Empresa } from './empresas/empresas.entity';
import { Departamento } from './departamentos/departamento.entity';
import { Cenco } from './cencos/cenco.entity';
import { TipoDispositivo } from './tipo-dispositivo/entities/tipo-dispositivo.entity';
import { Dispositivo } from './dispositivo/entities/dispositivo.entity';
import { Cargo } from './cargos/entities/cargo.entity';
import { Horario } from './horario/entities/horario.entity';
import { Turno } from './turno/entities/turno.entity';
import { Empleado } from './empleado/entities/empleado.entity';
import { Afp } from './afp/entities/afp.entity';
import { ErrorRechazo } from './error-rechazo/entities/error-rechazo.entity';
import { ProveedorCorreo } from './proveedor-correo/entities/proveedor-correo.entity';
import { Feriado } from './feriados/entities/feriado.entity';
import { TipoAusencia } from './tipo-ausencia/entities/tipo-ausencia.entity';
import { SesionActiva } from './sesion-activa/entities/sesion-activa.entity';
import { DetalleTurno } from './detalle-turno/entities/detalle-turno.entity';
import { Semana } from './semana/entities/semana.entity';
import { TipoMarca } from './tipo-marcas/entities/tipo-marca.entity';
import { AsignacionTurnoRotativo } from './asignacion_turno_rotativo/entities/asignacion_turno_rotativo.entity';
import { Marca } from './marcas/entities/marca.entity';
import { MarcaRechazo } from './marcas/entities/marca-rechazo.entity';
import { MarcasAuditoria } from './marcas-auditoria/entities/marcas-auditoria.entity';
import { Vacaciones } from './vacaciones/entities/vacaciones.entity';
import { Ausencia } from './ausencias/entities/ausencia.entity';
import { AutorizaHorasExtra } from './autoriza_horas_extras/entities/autoriza_horas_extra.entity';
import { DetalleAsistencia } from './detalle-asistencia/entities/detalle-asistencia.entity';
import { Alerta } from './alertas/entities/alerta.entity';
import { Teletrabajo } from './teletrabajo/entities/teletrabajo.entity';
import { AuditoriaTurno } from './detalle-turno/entities/auditoria-turno.entity';
import { HorasLegale } from './horas_legales/entities/horas_legale.entity';
import { Documento } from './documento/entities/documento.entity';
import { Firma } from './firmas/entities/firma.entity';
import { Solicitude } from './solicitudes/entities/solicitude.entity';
import { RegistroConexione } from './registro_conexiones/entities/registro_conexione.entity';
import { RegistroEvento } from './registro_evento/entities/registro_evento.entity';
import { HorasCompensacion } from './horas_compensacion/entities/horas_compensacion.entity';
import { SolicitudHorasCompensacion } from './solicitud_horas_compensacion/entities/solicitud_horas_compensacion.entity';
import { Huella } from './huellas/entities/huella.entity';
import { TareaHuella } from './tareas-huellas/entities/tarea-huella.entity';

import { PerfilesService } from './perfiles/perfiles.service';
import { PerfilesController } from './perfiles/perfiles.controller';
import { AppController } from './app.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: "Admin",
      database: 'postgres',
      synchronize: false,
      ssl: true,
      extra: {
        //  ssl: {
        //  rejectUnauthorized: false,
        //},
      },
      entities: [
        User,
        Perfil,
        Estado,
        Menu,
        Empresa,
        Departamento,
        Cenco,
        TipoDispositivo,
        Dispositivo,
        Cargo,
        Horario,
        Turno,
        Empleado,
        Afp,
        ErrorRechazo,
        ProveedorCorreo,
        Feriado,
        TipoAusencia,
        SesionActiva,
        DetalleTurno,
        Semana,
        TipoMarca,
        AsignacionTurnoRotativo,
        Marca,
        MarcaRechazo,
        MarcasAuditoria,
        Vacaciones,
        Ausencia,
        AutorizaHorasExtra,
        DetalleAsistencia,
        Alerta,
        Teletrabajo,
        AuditoriaTurno,
        HorasLegale,
        Documento,
        Firma,
        Solicitude,
        RegistroConexione,
        RegistroEvento,
        HorasCompensacion,
        SolicitudHorasCompensacion,
        Huella,
        TareaHuella
      ]
    }),
    MailerModule.forRoot({
      transport: {
        host: 'mail.femase.cl',
        port: 465,
        secure: true,
        auth: {
          user: 'no_reply@femase.cl',
          pass: process.env.MAIL_PASSWORD
        },
        tls: {
          rejectUnauthorized: false
        }
      },
      defaults: {
        from: '"no-reply" <no_reply@femase.cl>'
      }
    }),
    AuthModule,
    UsersModule,
    MenusModule,
    PerfilesModule,
    EmpresasModule,
    DepartamentosModule,
    CencosModule,
    DispositivoModule,
    TipoDispositivoModule,
    CargosModule,
    TurnoModule,
    HorarioModule,
    EmpleadoModule,
    AfpModule,
    ErrorRechazoModule,
    ProveedorCorreoModule,
    FeriadosModule,
    TipoAusenciaModule,
    SesionActivaModule,
    DetalleTurnoModule,
    SemanaModule,
    TipoMarcasModule,
    AsignacionTurnoRotativoModule,
    MarcasModule,
    MarcasAuditoriaModule,
    ReportesModule,
    VacacionesModule,
    AusenciasModule,
    AutorizaHorasExtrasModule,
    RegistroEventoModule,
    DetalleAsistenciaModule,
    AlertasModule,
    TeletrabajoModule,
    HorasLegalesModule,
    DocumentoModule,
    FirmasModule,
    SolicitudesModule,
    RegistroConexionesModule,
    HorasCompensacionModule,
    SolicitudHorasCompensacionModule,
    HuellasModule,
    TareasHuellasModule
  ],
  providers: [PerfilesService],
  controllers: [PerfilesController, AppController],
})
export class AppModule { }
