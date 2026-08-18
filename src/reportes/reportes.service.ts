import { Injectable, HttpException } from '@nestjs/common';
const pdfmake = require('pdfmake');
import { MarcasService } from '../marcas/marcas.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Empleado } from '../empleado/entities/empleado.entity';
import { Feriado } from '../feriados/entities/feriado.entity';
import { Between, Repository } from 'typeorm';
import { AttendanceRecordDto, UserReportDto } from './dto/attendance-report.dto';
import { Vacaciones } from 'src/vacaciones/entities/vacaciones.entity';
import { Ausencia } from 'src/ausencias/entities/ausencia.entity';
import { DetalleAsistenciaService } from '../detalle-asistencia/detalle-asistencia.service';
import { AuditoriaTurno } from '../detalle-turno/entities/auditoria-turno.entity';
import { User } from 'src/users/user.entity';
import { RegistroEvento } from 'src/registro_evento/entities/registro_evento.entity';
import { RegistroConexione } from 'src/registro_conexiones/entities/registro_conexione.entity';
import { Empresa } from 'src/empresas/empresas.entity';
import { AutorizaHorasExtra } from 'src/autoriza_horas_extras/entities/autoriza_horas_extra.entity';
const UAParser = require('ua-parser-js');

@Injectable()
export class ReportesService {
  constructor(
    private readonly marcasService: MarcasService,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(Feriado)
    private readonly feriadosRepository: Repository<Feriado>,
    @InjectRepository(Vacaciones)
    private readonly vacacionesRepository: Repository<Vacaciones>,
    @InjectRepository(Ausencia)
    private readonly ausenciaRepository: Repository<Ausencia>,
    @InjectRepository(AuditoriaTurno)
    private readonly auditoriaTurnoRepository: Repository<AuditoriaTurno>,
    @InjectRepository(RegistroConexione)
    private readonly registroConexioneRepository: Repository<RegistroConexione>,
    @InjectRepository(Empresa)
    private readonly empresaRepository: Repository<Empresa>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AutorizaHorasExtra)
    private readonly autorizaHorasExtraRepository: Repository<AutorizaHorasExtra>,
    private readonly detalleAsistenciaService: DetalleAsistenciaService,
  ) { }

  //crear pdf para jornada diaria 
  async generateAttendancePdf(numFichaStr: string, fechaInicio: string, fechaFin: string, idUsuario?: number, ip?: string, userAgent?: string): Promise<Buffer> {
    const numFichas = numFichaStr.split(',').map(f => f.trim()).filter(f => f.length > 0);
    const contentArr: any[] = [
      { text: `REPORTE DE JORNADA DIARIA\n\nPeriodo: ${fechaInicio} hasta ${fechaFin}`, style: 'subheader', alignment: 'center', margin: [0, 10, 0, 0] }
    ];

    const formatMs = (ms: number): string => {
      if (ms <= 0) return '00:00:00';
      const hrs = Math.floor(ms / 3600000);
      const mins = Math.floor((ms % 3600000) / 60000);
      const secs = Math.floor((ms % 60000) / 1000);
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const parseMs = (timeStr: any): number => {
      if (!timeStr || timeStr === '-' || timeStr === '00:00' || timeStr === '00:00:00') return 0;
      if (typeof timeStr === 'number') return timeStr * 60000; // Si ya viene en minutos
      if (typeof timeStr !== 'string') {
        // Si es un objeto Date (a veces pasa con columnas time)
        if (timeStr instanceof Date) {
          return (timeStr.getHours() * 3600000) + (timeStr.getMinutes() * 60000) + (timeStr.getSeconds() * 1000);
        }
        return 0;
      }
      const p = timeStr.split(':');
      if (p.length < 2) return 0;
      const hours = parseInt(p[0]);
      const minutes = parseInt(p[1]);
      const seconds = p.length >= 3 ? parseInt(p[2]) : 0;
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return 0;
      return (hours * 3600000) + (minutes * 60000) + (seconds * 1000);
    };

    const formatTimeStr = (t: string): string => {
      if (!t || t === '-') return '-';
      const p = t.split(':');
      if (p.length === 2) return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}:00`;
      if (p.length === 3) return `${p[0].padStart(2, '0')}:${p[1].padStart(2, '0')}:${p[2].padStart(2, '0')}`;
      return String(t).substring(0, 8);
    };

    for (let fIndex = 0; fIndex < numFichas.length; fIndex++) {
      const numFicha = numFichas[fIndex];
      const dataAsistencia = await this.detalleAsistenciaService.calcularAsistencia(numFicha, fechaInicio, fechaFin);
      const empleado = dataAsistencia.empleado;

      let totalDiasTrabajados = 0;
      let totalDiasAusente = 0;
      let totalDiasDescanso = 0;
      let totalDiasFeriado = 0;

      const registros = dataAsistencia.registros.map((reg: any) => {
        let isFeriadoLibre = false;
        if (reg.observacion === 'Feriado' && reg.entrada === '-' && reg.salida === '-') {
          isFeriadoLibre = true;
        }

        if (reg.entrada !== '-' || reg.salida !== '-') {
          totalDiasTrabajados++;
        } else if (isFeriadoLibre) {
          totalDiasFeriado++;
        } else if (reg.horasTeoricas === '-' || reg.horasTeoricas === '00:00') {
          totalDiasDescanso++;
        } else {
          totalDiasAusente++;
        }

        return reg;
      });

      const data: UserReportDto = {
        nombre: empleado.nombres + ' ' + empleado.apellido_paterno + ' ' + empleado.apellido_materno,
        cargo: empleado.cargo?.nombre || 'Sin cargo',
        rut: empleado.run,
        centroCosto: empleado.cenco?.nombre_cenco || 'Sin cenco',
        fechaIngreso: empleado.fecha_ini_contrato ? new Date(empleado.fecha_ini_contrato).toLocaleDateString('es-CL') : 'N/A',
        periodo: { desde: fechaInicio, hasta: fechaFin }, registros
      };

      const tableBody: any[] = [
        [
          { text: 'Fecha', style: 'tableHeader' },
          { text: 'Jornada ordinaria pactada', style: 'tableHeader' },
          { text: 'Marcaciones jornada', style: 'tableHeader' },
          { text: 'Colación', style: 'tableHeader' },
          { text: 'Marcaciones colación', style: 'tableHeader' },
          { text: 'Tiempo faltante', style: 'tableHeader' },
          { text: 'Tiempo extra', style: 'tableHeader' },
          { text: 'Otras marcaciones', style: 'tableHeader' },
          { text: 'Observaciones', style: 'tableHeader' },
          { text: 'Distribución excep. de jornada', style: 'tableHeader' }
        ]
      ];

      let semTeoricasMs = 0;
      let semPresencialesMs = 0;
      let semAtrasoMs = 0;
      let semJustificadasMs = 0;
      let semExtraMs = 0;
      let semNoTrabajadasMs = 0;
      let semColacionMs = 0;
      let semDiaMs = 0;

      for (let i = 0; i < data.registros.length; i++) {
        const reg: any = data.registros[i];

        semTeoricasMs += parseMs(reg.horasTeoricas);
        semPresencialesMs += parseMs(reg.horasPresenciales);

        let rowColMs = parseMs(reg.colacionTeorica);
        const sCMs = parseMs(reg.inicioColacionTeorica);
        const eCMs = parseMs(reg.finColacionTeorica);
        if (sCMs > 0 && eCMs > 0) {
          let d = eCMs - sCMs;
          if (d < 0) d += 24 * 3600000;
          rowColMs = d;
        }
        semColacionMs += rowColMs;

        semNoTrabajadasMs += parseMs(reg.horasNoTrabajadas);
        semExtraMs += parseMs(reg.horasExtra);
        semDiaMs += parseMs(reg.totalDia);

        let jornadaPactada = '-';
        if (reg.entradaTeorica && reg.entradaTeorica !== '-' && reg.salidaTeorica && reg.salidaTeorica !== '-') {
          jornadaPactada = `${formatTimeStr(reg.entradaTeorica)} - ${formatTimeStr(reg.salidaTeorica)}`;
        }

        const displayColacionStr = formatMs(parseMs(reg.colacionTeorica)).substring(0, 5);
        let colacionLimpia = '-';

        if (reg.inicioColacionTeorica && reg.inicioColacionTeorica !== '-' && reg.finColacionTeorica && reg.finColacionTeorica !== '-') {
          colacionLimpia = `${formatTimeStr(reg.inicioColacionTeorica)} - ${formatTimeStr(reg.finColacionTeorica)} (C: ${displayColacionStr})`;
        } else if (displayColacionStr !== '00:00') {
          colacionLimpia = `${formatTimeStr(reg.colacionTeorica)} (C: ${displayColacionStr})`;
        }

        let marcacionesJornada = '-';
        let marcacionesColacion = 'No aplica';
        let otrasMarcaciones = '-';

        if (reg.marcasDia && reg.marcasDia.length > 0) {
          const mSorted = [...reg.marcasDia].sort((a: any, b: any) => String(a.hora_marca).localeCompare(String(b.hora_marca)));
          if (mSorted.length === 1) {
            marcacionesJornada = `${formatTimeStr(String(mSorted[0].hora_marca))} -`;
          } else if (mSorted.length === 2) {
            marcacionesJornada = `${formatTimeStr(String(mSorted[0].hora_marca))} - ${formatTimeStr(String(mSorted[mSorted.length - 1].hora_marca))}`;
          } else if (mSorted.length === 3) {
            marcacionesJornada = `${formatTimeStr(String(mSorted[0].hora_marca))} - ${formatTimeStr(String(mSorted[mSorted.length - 1].hora_marca))}`;
            otrasMarcaciones = formatTimeStr(String(mSorted[1].hora_marca));
          } else if (mSorted.length >= 4) {
            marcacionesJornada = `${formatTimeStr(String(mSorted[0].hora_marca))} - ${formatTimeStr(String(mSorted[mSorted.length - 1].hora_marca))}`;
            marcacionesColacion = `${formatTimeStr(String(mSorted[1].hora_marca))} - ${formatTimeStr(String(mSorted[2].hora_marca))}`;
            if (mSorted.length > 4) {
              otrasMarcaciones = mSorted.slice(3, -1).map((m: any) => formatTimeStr(String(m.hora_marca))).join(', ');
            }
          }
        }

        const fechaParts = reg.fecha.split(' ');
        let fechaFormateada = reg.fecha;
        if (fechaParts.length === 2) {
          const dParts = fechaParts[1].split('-');
          if (dParts.length === 3) {
            fechaFormateada = `${dParts[0]}/${dParts[1]}/${dParts[2].substring(2)}`;
          }
        }

        let faltanteCelda: any = '- 00:00:00';
        const msAtraso = parseMs(reg.atraso);
        const msFaltanteTotal = parseMs(reg.horasNoTrabajadas);
        const msSalidaAnticipada = msFaltanteTotal - msAtraso;

        if (msFaltanteTotal > 0) {
          const lines: string[] = [];
          if (msAtraso > 0) {
            lines.push(`A.T: -${formatMs(msAtraso)}`);
          }
          if (msSalidaAnticipada > 0) {
            lines.push(`S.A: -${formatMs(msSalidaAnticipada)}`);
          }
          // Si por alguna razón hay faltante pero no es atraso ni salida (ej: ausencia total), mostramos el total
          if (lines.length === 0) {
            lines.push(`- ${formatMs(msFaltanteTotal)}`);
          }
          faltanteCelda = lines.join('\n');
        }

        tableBody.push([
          fechaFormateada,
          jornadaPactada,
          marcacionesJornada,
          colacionLimpia,
          marcacionesColacion,
          { text: faltanteCelda, fontSize: 8 },
          reg.horasExtra && reg.horasExtra !== '-' && reg.horasExtra !== '00:00' ? '+ ' + formatTimeStr(reg.horasExtra) : '+ 00:00:00',
          otrasMarcaciones,
          reg.observacion,
          'No Aplica'
        ]);

        const isSunday = reg.fecha.startsWith('Do.');
        const isLastRecord = i === data.registros.length - 1;

        if (isSunday || isLastRecord) {
          tableBody.push([
            { text: 'Total Semana', style: 'tableHeader', alignment: 'right' },
            { text: formatMs(semTeoricasMs), style: 'tableHeader' },
            { text: formatMs(semPresencialesMs), style: 'tableHeader' },
            { text: formatMs(semColacionMs), style: 'tableHeader' },
            { text: '', style: 'tableHeader' },
            { text: '- ' + formatMs(semNoTrabajadasMs), style: 'tableHeader' },
            { text: '+ ' + formatMs(semExtraMs), style: 'tableHeader' },
            { text: '', style: 'tableHeader' },
            { text: '', style: 'tableHeader' },
            { text: '', style: 'tableHeader' }
          ]);

          semTeoricasMs = 0;
          semPresencialesMs = 0;
          semColacionMs = 0;
          semAtrasoMs = 0;
          semJustificadasMs = 0;
          semExtraMs = 0;
          semNoTrabajadasMs = 0;
          semDiaMs = 0;
        }
      }

      const autorizadas = await this.autorizaHorasExtraRepository.find({
        where: {
          empleado: { num_ficha: numFicha },
          estado: 'A',
          fecha_marca: Between(new Date(fechaInicio), new Date(fechaFin))
        }
      });

      let totalExtraAprobadasMs = 0;
      for (const auth of autorizadas) {
        if (auth.horas_extras) {
          totalExtraAprobadasMs += parseMs(auth.horas_extras);
        }
      }
      const horasExtrasAprobadasStr = formatMs(totalExtraAprobadasMs);

      contentArr.push(
        {
          columns: [
            { text: `Razón Social: ${dataAsistencia.empleado.empresa?.nombre_empresa.toUpperCase() || 'FEMASE'}\nRUT Empresa: ${dataAsistencia.empleado.empresa?.rut_empresa || 'Sin rut'}\nDependiente sujeto a banda horaria: NO\nHorario Flexible: ${dataAsistencia.empleado.tiene_turno_flexible ? 'S' : 'N'}`, width: '*', fontSize: 8 },
            { text: `Nombre: ${data.nombre.toUpperCase()}\nRUT: ${data.rut}\nLugar de prestación de servicios: ${data.centroCosto.toUpperCase()}`, width: '*', fontSize: 8 }
          ],
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', '*', 'auto'],
            body: tableBody
          }
        },
        {
          text: `Resumen:\nTotal dias trabajados: ${totalDiasTrabajados}\nTotal Días Ausente: ${totalDiasAusente}\nTotal Días Descanso: ${totalDiasDescanso}\nTotal Días Feriado: ${totalDiasFeriado}\nHoras Extras aprobadas: ${horasExtrasAprobadasStr}`,
          margin: [0, 10, 0, 10],
          fontSize: 8,
          bold: true
        }
      );
    }

    const fonts = {
      Arial: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const docDefinition = {
      pageOrientation: 'landscape',
      content: contentArr,
      styles: {
        header: { fontSize: 8, bold: true },
        subheader: { fontSize: 8, bold: true, margin: [0, 5, 0, 5] as [number, number, number, number] },
        tableHeader: { bold: true, fontSize: 8 }
      },
      defaultStyle: { font: 'Arial', fontSize: 8 }
    };

    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    // --- AUDITORÍA ---
    if (idUsuario && !isNaN(idUsuario)) {
      const autor = await this.empleadoRepository.manager.findOne(User, {
        where: { usuario_id: idUsuario },
        relations: ['empleado', 'empresa']
      });

      if (autor) {
        let empleadoAutor: Empleado | null = null;
        if (autor?.empleado?.empleado_id) {
          empleadoAutor = await this.empleadoRepository.manager.findOne(Empleado, {
            where: { empleado_id: autor.empleado.empleado_id },
            relations: ['empresa', 'cenco', 'cenco.departamento']
          });
        }

        const parser = new UAParser(userAgent || '');
        const navegador = `${parser.getBrowser().name}-${parser.getBrowser().version}`;

        const registroEvento = this.empleadoRepository.manager.create(RegistroEvento, {
          usuario: autor?.username,
          evento: `El usuario ${autor?.username} de la empresa ${autor?.empresa?.nombre_empresa || 'Sin Empresa'} ha generado el reporte de Jornada Diaria para las fichas: ${numFichaStr} en el periodo ${fechaInicio} al ${fechaFin}`,
          tipo_evento: 'Reporte Asistencia Jornada Diaria',
          ip: ip || 'Desconocida',
          fecha: new Date(),
          hora: new Date().toTimeString().split(' ')[0],
          sistema_operativo: parser.getOS().name || 'Desconocido',
          browser: navegador,
          empresa: empleadoAutor?.empresa?.nombre_empresa || autor?.empresa?.nombre_empresa,
          depto: empleadoAutor?.cenco?.departamento?.nombre_departamento || "Sin Depto",
          cenco: empleadoAutor?.cenco?.nombre_cenco || "Sin Cenco",
          rut: autor?.run_usuario
        });

        await this.empleadoRepository.manager.save(registroEvento);
      }
    }
    // -----------------

    return buffer;
  }

  //crear pdf para asistencia
  async generateSimpleAttendancePdf(numFichaStr: string, fechaInicio: string, fechaFin: string, idUsuario?: number, ip?: string, userAgent?: string): Promise<Buffer> {
    const numFichas = numFichaStr.split(',').map(f => f.trim()).filter(f => f.length > 0);
    const contentArr: any[] = [
      { text: `REPORTE DE ASISTENCIA\n\nPeriodo: ${fechaInicio} hasta ${fechaFin}`, style: 'subheader', alignment: 'center', margin: [0, 10, 0, 0] }
    ];

    for (let fIndex = 0; fIndex < numFichas.length; fIndex++) {
      const numFicha = numFichas[fIndex];
      const dataAsistencia = await this.detalleAsistenciaService.calcularAsistencia(numFicha, fechaInicio, fechaFin);
      const empleado = dataAsistencia.empleado;

      const data = {
        nombre: empleado.nombres + ' ' + empleado.apellido_paterno + ' ' + empleado.apellido_materno,
        cargo: empleado.cargo?.nombre || 'Sin cargo',
        rut: empleado.run,
        centroCosto: empleado.cenco?.nombre_cenco || 'Sin cenco',
        periodo: { desde: fechaInicio, hasta: fechaFin },
        empresa: empleado.empresa?.nombre_empresa || 'FEMASE',
        rutEmpresa: empleado.empresa?.rut_empresa || 'Sin rut'
      };

      const tableBody: any[] = [
        [
          { text: 'Fecha', style: 'tableHeader' },
          { text: 'Asistencia', style: 'tableHeader' },
          { text: 'Ausencia', style: 'tableHeader' },
          { text: 'Observaciones', style: 'tableHeader' }
        ]
      ];

      for (let i = 0; i < dataAsistencia.registros.length; i++) {
        const reg = dataAsistencia.registros[i];

        const fechaParts = reg.fecha.split(' ');
        let fechaFormateada = reg.fecha;
        if (fechaParts.length === 2) {
          const dParts = fechaParts[1].split('-');
          if (dParts.length === 3) {
            fechaFormateada = `${dParts[0]}/${dParts[1]}/${dParts[2]}`;
          }
        }

        const esLibreOFeriado = reg.observacion === 'FERIADO' || reg.observacion === 'DIA LIBRE' || reg.horasTeoricas === '-' || reg.horasTeoricas === '00:00';
        const tieneMarca = reg.entrada !== '-' || reg.salida !== '-';

        let asistenciaTxt = tieneMarca ? 'SI' : 'NO';
        let ausenciaTxt = '-';
        let observacionEfectiva = reg.observacion;

        if (tieneMarca) {
          observacionEfectiva = 'PRESENTE CON MARCA';
        } else {
          if (esLibreOFeriado) {
            ausenciaTxt = '-';
            observacionEfectiva = reg.observacion === 'FERIADO' ? 'FERIADO' : 'DIA LIBRE';
          } else {
            if ((reg.horasJustificadas !== '-' && reg.horasJustificadas !== '00:00') || reg.observacion.includes('AUSENCIA') || reg.observacion.includes('JUSTIFICADA') || reg.observacion.includes('LICENCIA') || reg.observacion.includes('VACACIONES')) {
              ausenciaTxt = 'JUSTIFICADA';
            } else {
              ausenciaTxt = 'INJUSTIFICADA';
              observacionEfectiva = 'IN. NO JUSTIFICADA';
            }
          }
        }

        tableBody.push([
          fechaFormateada,
          asistenciaTxt,
          ausenciaTxt,
          observacionEfectiva.toUpperCase()
        ]);
      }

      contentArr.push(
        {
          columns: [
            { text: `Razón Social: ${data.empresa.toUpperCase()}\nRUT Empresa: ${data.rutEmpresa}\n`, width: '*', fontSize: 8 },
            { text: `Nombre: ${data.nombre.toUpperCase()}\nRUT: ${data.rut}\nLugar de prestación de servicios: ${data.centroCosto.toUpperCase()}`, width: '*', fontSize: 8 }
          ],
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '15%', '25%', '*'],
            body: tableBody
          }
        }
      );
    }

    const fonts = {
      Arial: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const docDefinition = {
      pageOrientation: 'landscape',
      content: contentArr,
      styles: {
        header: { fontSize: 8, bold: true },
        subheader: { fontSize: 8, bold: true, margin: [0, 5, 0, 5] as [number, number, number, number] },
        tableHeader: { bold: true, fontSize: 8 }
      },
      defaultStyle: { font: 'Arial', fontSize: 8 }
    };

    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    // --- AUDITORÍA ---
    if (idUsuario && !isNaN(idUsuario)) {
      const autor = await this.empleadoRepository.manager.findOne(User, {
        where: { usuario_id: idUsuario },
        relations: ['empleado', 'empresa']
      });

      if (autor) {
        let empleadoAutor: Empleado | null = null;
        if (autor?.empleado?.empleado_id) {
          empleadoAutor = await this.empleadoRepository.manager.findOne(Empleado, {
            where: { empleado_id: autor.empleado.empleado_id },
            relations: ['empresa', 'cenco', 'cenco.departamento']
          });
        }

        const parser = new UAParser(userAgent || '');
        const navegador = `${parser.getBrowser().name}-${parser.getBrowser().version}`;

        const registroEvento = this.empleadoRepository.manager.create(RegistroEvento, {
          usuario: autor?.username,
          evento: `El usuario ${autor?.username} de la empresa ${autor?.empresa?.nombre_empresa || 'Sin Empresa'} ha generado el reporte de Asistencia Simple para las fichas: ${numFichaStr} en el periodo ${fechaInicio} al ${fechaFin}`,
          tipo_evento: 'Reporte Asistencia Simple',
          ip: ip || 'Desconocida',
          fecha: new Date(),
          hora: new Date().toTimeString().split(' ')[0],
          sistema_operativo: parser.getOS().name || 'Desconocido',
          browser: navegador,
          empresa: empleadoAutor?.empresa?.nombre_empresa || autor?.empresa?.nombre_empresa,
          depto: empleadoAutor?.cenco?.departamento?.nombre_departamento || "Sin Depto",
          cenco: empleadoAutor?.cenco?.nombre_cenco || "Sin Cenco",
          rut: autor?.run_usuario
        });

        await this.empleadoRepository.manager.save(registroEvento);
      }
    }
    // -----------------

    return buffer;
  }

  async generarReporteVacaciones(numFicha: string, idUsuario?: number, ip?: string, userAgent?: string): Promise<Buffer> {
    const busquedaEmpleado = await this.empleadoRepository.findOne({
      where: {
        num_ficha: numFicha
      },
      relations: ['cenco', 'empresa', 'cargo']
    });

    if (!busquedaEmpleado) {
      throw new HttpException('Empleado no encontrado', 404);
    }

    const busquedaVacaciones = await this.vacacionesRepository.find({
      where: {
        empleado: {
          num_ficha: busquedaEmpleado?.num_ficha
        },
        estado: 'A'
      },
      relations: ['empleado'],
      order: {
        fecha_inicio: 'ASC'
      }
    });

    const formatDate = (d: any) => {
      if (!d) return 'N/A';
      if (typeof d === 'string') return d.substring(0, 10).split('-').reverse().join('-');
      if (d instanceof Date) return d.toISOString().substring(0, 10).split('-').reverse().join('-');
      return String(d);
    };

    const tableBody: any[] = [
      [
        { text: 'Fecha Inicio', style: 'tableHeader' },
        { text: 'Fecha Fin', style: 'tableHeader' },
        { text: 'Días\nAcum.', style: 'tableHeader' },
        { text: 'Días\nEfectivos', style: 'tableHeader' },
        { text: 'Saldo Días\nAsignados', style: 'tableHeader' },
        { text: 'Autorizada\nPor', style: 'tableHeader' },
        { text: 'Días Efec.\nVP', style: 'tableHeader' },
        { text: 'Saldo VBA\nPrevio', style: 'tableHeader' },
        { text: 'Saldo VP\nPrevio', style: 'tableHeader' },
        { text: 'Saldo VBA\nPost', style: 'tableHeader' },
        { text: 'Saldo VP\nPost', style: 'tableHeader' }
      ]
    ];
    let totalDiasEfectivos = 0;

    for (let i = 0; i < busquedaVacaciones.length; i++) {
      const vacacion = busquedaVacaciones[i];

      const fInicio = formatDate(vacacion.fecha_inicio);
      const fFin = formatDate(vacacion.fecha_fin);

      const diasAcumuladosNumber = Number(vacacion.dias_acumulados || 0);
      const diasAcumulados = diasAcumuladosNumber.toFixed(2);

      const diasEf = Number(vacacion.dias_efectivos || 0);
      const diasEfectivos = diasEf.toFixed(2);

      totalDiasEfectivos += diasEf;

      const diasEfectivosVP = '0.00';

      const saldoVPPrevio = '0.00';

      const saldoAsignadosNum = diasAcumuladosNumber - totalDiasEfectivos;
      const saldoAsignados = saldoAsignadosNum.toFixed(2);
      const saldoVBAPost = saldoAsignadosNum.toFixed(2);
      const saldoVPPost = '0.00';

      const saldoVBAPrevio = (diasEf + saldoAsignadosNum).toFixed(2);
      const autorizadaPor = vacacion.autorizador || 'S/I';

      tableBody.push([
        fInicio, fFin, diasAcumulados, diasEfectivos, saldoAsignados, autorizadaPor,
        diasEfectivosVP, saldoVBAPrevio, saldoVPPrevio, saldoVBAPost, saldoVPPost
      ]);
    }

    if (busquedaVacaciones.length === 0) {
      tableBody.push([{ text: 'No hay vacaciones registradas', colSpan: 11, alignment: 'center' }, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}]);
    }

    const fechaInicioContrato = new Date(busquedaEmpleado.fecha_ini_contrato);
    fechaInicioContrato.setHours(0, 0, 0, 0);
    const fechaGeneracion = new Date();
    fechaGeneracion.setHours(0, 0, 0, 0);

    let mesesTrabajados = (fechaGeneracion.getFullYear() - fechaInicioContrato.getFullYear()) * 12 + (fechaGeneracion.getMonth() - fechaInicioContrato.getMonth());

    if (fechaGeneracion.getDate() < fechaInicioContrato.getDate()) {
      mesesTrabajados--;
    }
    if (mesesTrabajados < 0) mesesTrabajados = 0;

    const diasDelMesActualGen = new Date(fechaGeneracion.getFullYear(), fechaGeneracion.getMonth() + 1, 0).getDate();
    let fechaUltimoCumpleMesGen = new Date(fechaInicioContrato);
    fechaUltimoCumpleMesGen.setMonth(fechaInicioContrato.getMonth() + mesesTrabajados);

    const diffTimeGen = fechaGeneracion.getTime() - fechaUltimoCumpleMesGen.getTime();
    const diasSueltosGen = Math.floor(diffTimeGen / (1000 * 60 * 60 * 24));

    const proporcionalesNormales = (1.25 / diasDelMesActualGen) * diasSueltosGen;
    const totalNormales = (mesesTrabajados * 1.25) + proporcionalesNormales;

    let totalZonaExtrema = 0;
    if (busquedaEmpleado.cenco?.zona_extrema) {
      const proporcionalesZE = (0.42 / diasDelMesActualGen) * diasSueltosGen;
      totalZonaExtrema = (mesesTrabajados * 0.42) + proporcionalesZE;
    }

    const totalAcumulados = totalNormales + totalZonaExtrema;

    let diasUtilizados = 0;
    for (const v of busquedaVacaciones) {
      diasUtilizados += Number(v.dias_efectivos || 0);
    }
    const diasDisponibles = totalAcumulados - diasUtilizados;

    const textoResumen =
      `Total de días:\n` +
      `Normales: ${totalNormales.toFixed(2)}  -  Adicionales: 0.00  -  Progresivos: 0.00  -  Zona Extrema: ${totalZonaExtrema.toFixed(2)}  -  Especiales: 0.00\n\n` +
      `Total de vacaciones acumuladas (al ${fechaGeneracion.toLocaleDateString('es-CL')}): ${totalAcumulados.toFixed(2)}\n` +
      `Total de días utilizados: ${diasUtilizados.toFixed(2)}\n` +
      `Total de días disponibles: ${diasDisponibles.toFixed(2)}`;

    const fonts = {
      Arial: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const docDefinition = {
      pageOrientation: 'landscape',
      content: [
        {
          columns: [
            { text: busquedaEmpleado.empresa?.nombre_empresa || 'Fundación Mi Casa', style: 'header', alignment: 'left', width: '*' },
            { text: 'Fecha generación documento: ' + new Date().toLocaleString('es-CL'), alignment: 'right', fontSize: 8, margin: [0, 2, 0, 0], width: 'auto' }
          ]
        },
        { text: 'Historial de Vacaciones por Persona', style: 'subheader', alignment: 'center', margin: [0, 10, 0, 0] },
        {
          columns: [
            { text: `Nombre: ${busquedaEmpleado.nombres} ${busquedaEmpleado.apellido_paterno} ${busquedaEmpleado.apellido_materno}\nCargo: ${busquedaEmpleado.cargo?.nombre || 'Sin cargo'}`, width: '*', fontSize: 8 },
            { text: `RUT: ${busquedaEmpleado.run}\nFecha Ingreso: ${formatDate(busquedaEmpleado.fecha_ini_contrato)}\nCenco: ${busquedaEmpleado.cenco?.nombre_cenco || 'Sin cenco'}`, width: '*', fontSize: 8 }
          ],
          margin: [0, 10, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody
          }
        },
        {
          margin: [0, 30, 0, 0],
          columns: [
            {
              width: '60%',
              text: textoResumen,
              style: 'resumenTexto',
              alignment: 'left'
            },
            {
              width: '40%',
              columns: [
                { text: '__________________\nV° B° Recursos Humanos', alignment: 'center', fontSize: 8 },
                { text: '__________________\nV° B° Trabajador', alignment: 'center', fontSize: 8 }
              ]
            }
          ]
        }
      ],
      styles: {
        header: { fontSize: 8, bold: true },
        subheader: { fontSize: 8, bold: true, margin: [0, 5, 0, 5] as [number, number, number, number] },
        resumenTexto: { fontSize: 8, margin: [0, 5, 0, 5] as [number, number, number, number] },
        tableHeader: { bold: true, fontSize: 8, alignment: 'center' }
      },
      defaultStyle: { font: 'Arial', fontSize: 8, alignment: 'center' }
    };

    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    // --- AUDITORÍA ---
    if (idUsuario && !isNaN(idUsuario)) {
      const autor = await this.empleadoRepository.manager.findOne(User, {
        where: { usuario_id: idUsuario },
        relations: ['empleado', 'empresa']
      });

      if (autor) {
        let empleadoAutor: Empleado | null = null;
        if (autor?.empleado?.empleado_id) {
          empleadoAutor = await this.empleadoRepository.manager.findOne(Empleado, {
            where: { empleado_id: autor.empleado.empleado_id },
            relations: ['empresa', 'cenco', 'cenco.departamento']
          });
        }

        const parser = new UAParser(userAgent || '');
        const navegador = `${parser.getBrowser().name}-${parser.getBrowser().version}`;

        const registroEvento = this.empleadoRepository.manager.create(RegistroEvento, {
          usuario: autor?.username,
          evento: `El usuario ${autor?.username} de la empresa ${autor?.empresa?.nombre_empresa || 'Sin Empresa'} ha generado el reporte de Historial de Vacaciones para el empleado con ficha: ${numFicha}`,
          tipo_evento: 'Reporte Vacaciones',
          ip: ip || 'Desconocida',
          fecha: new Date(),
          hora: new Date().toTimeString().split(' ')[0],
          sistema_operativo: parser.getOS().name || 'Desconocido',
          browser: navegador,
          empresa: empleadoAutor?.empresa?.nombre_empresa || autor?.empresa?.nombre_empresa,
          depto: empleadoAutor?.cenco?.departamento?.nombre_departamento || "Sin Depto",
          cenco: empleadoAutor?.cenco?.nombre_cenco || "Sin Cenco",
          rut: autor?.run_usuario
        });

        await this.empleadoRepository.manager.save(registroEvento);
      }
    }
    // -----------------

    return buffer;
  }

  async generarReporteAusencias(
    numFicha: string,
    fechaInicioStr?: string,
    fechaFinStr?: string,
    idUsuario?: number,
    ip?: string,
    userAgent?: string
  ): Promise<Buffer> {
    const busquedaEmpleado = await this.empleadoRepository.findOne({
      where: {
        num_ficha: numFicha
      },
      relations: ['cenco', 'empresa', 'cargo']
    });

    if (!busquedaEmpleado) {
      throw new HttpException('Empleado no encontrado', 404);
    }

    const where: any = {
      num_ficha: numFicha
    };

    if (fechaInicioStr && fechaFinStr) {
      where.fecha_fin = Between(new Date(fechaInicioStr), new Date(fechaFinStr));
    }

    const busquedaAusencias = await this.ausenciaRepository.find({
      order: {
        id: 'ASC'
      },
      relations: ['tipo_ausencia'],
      where: where
    });

    const formatDate = (d: any) => {
      if (!d) return 'N/A';
      if (typeof d === 'string') return d.substring(0, 10).split('-').reverse().join('-');
      if (d instanceof Date) return d.toISOString().substring(0, 10).split('-').reverse().join('-');
      return String(d);
    };

    const tableBody: any[] = [
      [
        { text: 'Fecha', style: 'tableHeader' },
        { text: 'Tipo', style: 'tableHeader' },
        { text: '¿Por horas?', style: 'tableHeader' },
        { text: 'Fecha Inicio', style: 'tableHeader' },
        { text: 'Hora Inicio', style: 'tableHeader' },
        { text: 'Fecha Fin', style: 'tableHeader' },
        { text: 'Hora Fin', style: 'tableHeader' },
        { text: '¿Autorizada?', style: 'tableHeader' },
        { text: 'Autoriza', style: 'tableHeader' }
      ]
    ];

    for (let i = 0; i < busquedaAusencias.length; i++) {
      const ausencia = busquedaAusencias[i];

      tableBody.push([
        formatDate(ausencia.fecha_creacion),
        ausencia.tipo_ausencia?.nombre || 'S/I',
        ausencia.dia_completo ? 'No' : 'Sí',
        formatDate(ausencia.fecha_inicio),
        ausencia.hora_inicio || '-',
        formatDate(ausencia.fecha_fin),
        ausencia.hora_fin || '-',
        ausencia.autorizada ? 'Sí' : 'No',
        ausencia.autorizador || '-'
      ]);
    }

    if (busquedaAusencias.length === 0) {
      tableBody.push([{ text: 'No hay ausencias registradas', colSpan: 9, alignment: 'center' }, {}, {}, {}, {}, {}, {}, {}, {}]);
    }

    const fonts = {
      Arial: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const docDefinition = {
      pageOrientation: 'landscape',
      content: [
        {
          columns: [
            { text: busquedaEmpleado.empresa?.nombre_empresa || 'Fundación Mi Casa', style: 'header', alignment: 'left', width: '*' },
            { text: 'Fecha generación documento: ' + new Date().toLocaleString('es-CL'), alignment: 'right', fontSize: 8, margin: [0, 2, 0, 0], width: 'auto' }
          ]
        },
        { text: 'Reporte de Ausencias por Persona', style: 'subheader', alignment: 'center', margin: [0, 10, 0, 0] },
        {
          columns: [
            { text: `Nombre: ${busquedaEmpleado.nombres} ${busquedaEmpleado.apellido_paterno} ${busquedaEmpleado.apellido_materno}\nCargo: ${busquedaEmpleado.cargo?.nombre || 'Sin cargo'}`, width: '*', fontSize: 8 },
            { text: `RUT: ${busquedaEmpleado.run}\nFecha Ingreso: ${formatDate(busquedaEmpleado.fecha_ini_contrato)}\nCenco: ${busquedaEmpleado.cenco?.nombre_cenco || 'Sin cenco'}`, width: '*', fontSize: 8 }
          ],
          margin: [0, 10, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body: tableBody
          }
        },
        {
          margin: [0, 30, 0, 0],
          columns: [
            {
              width: '60%',
              text: '',
              style: 'resumenTexto',
              alignment: 'left'
            },
            {
              width: '40%',
              columns: [
                { text: '__________________\nV° B° Recursos Humanos', alignment: 'center', fontSize: 8 },
                { text: '__________________\nV° B° Trabajador', alignment: 'center', fontSize: 8 }
              ]
            }
          ]
        }
      ],
      styles: {
        header: { fontSize: 8, bold: true },
        subheader: { fontSize: 8, bold: true, margin: [0, 5, 0, 5] as [number, number, number, number] },
        resumenTexto: { fontSize: 8, margin: [0, 5, 0, 5] as [number, number, number, number] },
        tableHeader: { bold: true, fontSize: 8, alignment: 'center' }
      },
      defaultStyle: { font: 'Arial', fontSize: 8, alignment: 'center' }
    };

    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    // --- AUDITORÍA ---
    if (idUsuario && !isNaN(idUsuario)) {
      const autor = await this.empleadoRepository.manager.findOne(User, {
        where: { usuario_id: idUsuario },
        relations: ['empleado', 'empresa']
      });

      if (autor) {
        let empleadoAutor: Empleado | null = null;
        if (autor?.empleado?.empleado_id) {
          empleadoAutor = await this.empleadoRepository.manager.findOne(Empleado, {
            where: { empleado_id: autor.empleado.empleado_id },
            relations: ['empresa', 'cenco', 'cenco.departamento']
          });
        }

        const parser = new UAParser(userAgent || '');
        const navegador = `${parser.getBrowser().name}-${parser.getBrowser().version}`;
        const fechaAuditoria = fechaInicioStr && fechaFinStr ? `(${fechaInicioStr} al ${fechaFinStr})` : '(Histórico completo)';

        const registroEvento = this.empleadoRepository.manager.create(RegistroEvento, {
          usuario: autor?.username,
          evento: `El usuario ${autor?.username} de la empresa ${autor?.empresa?.nombre_empresa || 'Sin Empresa'} ha generado un reporte de ausencias ${fechaAuditoria} para el empleado "${busquedaEmpleado.nombres} ${busquedaEmpleado.apellido_paterno}" perteneciente a la empresa "${busquedaEmpleado.empresa?.nombre_empresa || 'Desconocida'}"`,
          tipo_evento: 'Descarga Reporte Ausencias',
          ip: ip || 'Desconocida',
          fecha: new Date(),
          hora: new Date().toTimeString().split(' ')[0],
          sistema_operativo: parser.getOS().name || 'Desconocido',
          browser: navegador,
          empresa: empleadoAutor?.empresa?.nombre_empresa || autor?.empresa?.nombre_empresa,
          depto: empleadoAutor?.cenco?.departamento?.nombre_departamento || "Sin Depto",
          cenco: empleadoAutor?.cenco?.nombre_cenco || "Sin Cenco",
          rut: autor?.run_usuario
        });

        await this.empleadoRepository.manager.save(registroEvento);
      }
    }
    // -----------------

    return buffer;
  }

  async generateDomFestPdf(numFichaStr: string, fechaInicio: string, fechaFin: string, idUsuario?: number, ip?: string, userAgent?: string): Promise<Buffer> {
    const numFichas = numFichaStr.split(',').map(f => f.trim()).filter(f => f.length > 0);
    const contentArr: any[] = [
      { text: `REPORTE DOMINGOS Y FESTIVOS\n\nPeriodo: ${fechaInicio} hasta ${fechaFin}`, style: 'subheader', alignment: 'center', margin: [0, 10, 0, 0] }
    ];
    const feriados = await this.feriadosRepository.find();

    for (let fIndex = 0; fIndex < numFichas.length; fIndex++) {
      const numFicha = numFichas[fIndex];
      const dataAsistencia = await this.detalleAsistenciaService.calcularAsistencia(numFicha, fechaInicio, fechaFin);
      const empleado = dataAsistencia.empleado;

      const data = {
        nombre: empleado.nombres + ' ' + empleado.apellido_paterno + ' ' + empleado.apellido_materno,
        rut: empleado.run,
        centroCosto: empleado.cenco?.nombre_cenco || 'Sin cenco',
        periodo: { desde: fechaInicio, hasta: fechaFin },
        empresa: empleado.empresa?.nombre_empresa || 'FEMASE',
        rutEmpresa: empleado.empresa?.rut_empresa || 'Sin rut',
        cargo: empleado.cargo?.nombre || 'Sin cargo'
      };

      const tableBody: any[] = [
        [
          { text: 'Beneficiario descanso adicionales', style: 'tableHeader' },
          { text: 'Fecha', style: 'tableHeader' },
          { text: 'Asistencia', style: 'tableHeader' },
          { text: 'Ausencia', style: 'tableHeader' },
          { text: 'Observaciones', style: 'tableHeader' }
        ]
      ];

      const registrosMap = new Map<string, any>();
      dataAsistencia.registros.forEach((reg: any) => {
        const parts = reg.fecha.split(' ');
        if (parts.length === 2) {
          registrosMap.set(parts[1], reg);
        }
      });

      const start = new Date(fechaInicio + 'T12:00:00');
      const end = new Date(fechaFin + 'T12:00:00');

      const diasValidos: any[] = [];
      let trabajaDomingosOFestivos = false;

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay(); // 0 is Sunday
        const fStr = d.toISOString().split('T')[0]; // YYYY-MM-DD
        const [y, mStr, dStr] = fStr.split('-');
        const m = parseInt(mStr);
        const year = parseInt(y);
        const fDisplay = `${dStr}/${mStr}/${y.substring(2)}`; // DD/MM/YY
        const fDisplayHyphen = `${dStr}-${mStr}-${y}`;

        const isFeriado = feriados.some(fer => {
          let ferStr = '';
          if (fer.fecha instanceof Date) ferStr = fer.fecha.toISOString().split('T')[0];
          else ferStr = String(fer.fecha).substring(0, 10);
          return ferStr === fStr;
        });

        if (dayOfWeek === 0 || isFeriado) {
          const reg = registrosMap.get(fDisplayHyphen);

          let asistenciaTxt = 'NO';
          let ausenciaTxt = '';
          let observacionTxt = isFeriado ? 'FERIADO' : 'DOMINGO';
          let asistio = false;
          let debioAsistir = false;

          if (reg) {
            const tieneEntrada = reg.entrada && reg.entrada !== '-';
            const tieneSalida = reg.salida && reg.salida !== '-';
            const tieneHorasTeoricas = reg.horasTeoricas !== '-' && reg.horasTeoricas !== '00:00';

            if (tieneEntrada || tieneSalida) {
              asistio = true;
              debioAsistir = true;
              asistenciaTxt = 'SI';
              observacionTxt = 'PRESENTE CON MARCA';
            } else {
              asistenciaTxt = 'NO';
              if (tieneHorasTeoricas) {
                debioAsistir = true;
                if ((reg.horasJustificadas !== '-' && reg.horasJustificadas !== '00:00') || reg.observacion.includes('AUSENCIA') || reg.observacion.includes('JUSTIFICADA') || reg.observacion.includes('VACACIONES') || reg.observacion.includes('LICENCIA')) {
                  ausenciaTxt = 'JUSTIFICADA';
                  observacionTxt = reg.observacion || 'AUSENCIA JUSTIFICADA';
                } else {
                  ausenciaTxt = 'INJUSTIFICADA';
                  observacionTxt = reg.observacion && reg.observacion !== 'Feriado' ? reg.observacion : 'INASISTENCIA INJUSTIFICADA';
                }
              } else {
                debioAsistir = false;
              }
            }
          }

          if (asistio || debioAsistir) {
            trabajaDomingosOFestivos = true;
          }

          diasValidos.push({
            month: m,
            year: year,
            fDisplay,
            asistenciaTxt,
            ausenciaTxt,
            observacionTxt,
            asistio
          });
        }
      }

      let sumatoriaTotal = 0;

      if (!trabajaDomingosOFestivos) {
        tableBody.push([
          { text: 'La jornada de este trabajador no incluye domingos o festivos', colSpan: 5, alignment: 'center' },
          {}, {}, {}, {}
        ]);
      } else {
        let currentMonth = diasValidos[0].month;
        let currentYear = diasValidos[0].year;
        let sumatoriaMensual = 0;

        for (let i = 0; i < diasValidos.length; i++) {
          const dia = diasValidos[i];

          if (dia.month !== currentMonth || dia.year !== currentYear) {
            tableBody.push([
              { text: `Sumatoria mensual (${String(currentMonth).padStart(2, '0')}/${currentYear})`, colSpan: 2, alignment: 'right', bold: true },
              {},
              { text: String(sumatoriaMensual), bold: true },
              {},
              {}
            ]);
            currentMonth = dia.month;
            currentYear = dia.year;
            sumatoriaMensual = 0;
          }

          if (dia.asistio) {
            sumatoriaMensual++;
            sumatoriaTotal++;
          }

          tableBody.push([
            'No',
            dia.fDisplay,
            dia.asistenciaTxt,
            dia.ausenciaTxt,
            dia.observacionTxt.toUpperCase()
          ]);
        }

        tableBody.push([
          { text: `Sumatoria mensual (${String(currentMonth).padStart(2, '0')}/${currentYear})`, colSpan: 2, alignment: 'right', bold: true },
          {},
          { text: String(sumatoriaMensual), bold: true },
          {},
          {}
        ]);

        tableBody.push([
          { text: `Sumatoria total periodo`, colSpan: 2, alignment: 'right', bold: true },
          {},
          { text: String(sumatoriaTotal), bold: true },
          {},
          {}
        ]);
      }

      contentArr.push(
        {
          columns: [
            { text: `Razón Social: ${data.empresa.toUpperCase()}\nRUT Empresa: ${data.rutEmpresa}\nLugar de prestación de servicios: ${data.centroCosto.toUpperCase()}`, width: '*', fontSize: 8 },
            { text: `Nombre: ${data.nombre.toUpperCase()}\nRUT: ${data.rut}\nCargo: ${data.cargo.toUpperCase()}`, width: '*', fontSize: 8 }
          ],
          margin: [0, 20, 0, 10]
        },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', '*'],
            body: tableBody
          }
        }
      );
    }

    const fonts = {
      Arial: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const docDefinition = {
      pageOrientation: 'landscape',
      content: contentArr,
      styles: {
        header: { fontSize: 8, bold: true },
        subheader: { fontSize: 8, bold: true, margin: [0, 5, 0, 5] as [number, number, number, number] },
        tableHeader: { bold: true, fontSize: 8 }
      },
      defaultStyle: { font: 'Arial', fontSize: 8 }
    };

    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    // --- AUDITORÍA ---
    if (idUsuario && !isNaN(idUsuario)) {
      const autor = await this.empleadoRepository.manager.findOne(User, {
        where: { usuario_id: idUsuario },
        relations: ['empleado', 'empresa']
      });

      if (autor) {
        let empleadoAutor: Empleado | null = null;
        if (autor?.empleado?.empleado_id) {
          empleadoAutor = await this.empleadoRepository.manager.findOne(Empleado, {
            where: { empleado_id: autor.empleado.empleado_id },
            relations: ['empresa', 'cenco', 'cenco.departamento']
          });
        }

        const parser = new UAParser(userAgent || '');
        const navegador = `${parser.getBrowser().name}-${parser.getBrowser().version}`;

        const registroEvento = this.empleadoRepository.manager.create(RegistroEvento, {
          usuario: autor?.username,
          evento: `El usuario ${autor?.username} de la empresa ${autor?.empresa?.nombre_empresa || 'Sin Empresa'} ha generado el reporte de Domingos y Festivos para las fichas: ${numFichaStr} en el periodo ${fechaInicio} al ${fechaFin}`,
          tipo_evento: 'Reporte Domingos y Festivos',
          ip: ip || 'Desconocida',
          fecha: new Date(),
          hora: new Date().toTimeString().split(' ')[0],
          sistema_operativo: parser.getOS().name || 'Desconocido',
          browser: navegador,
          empresa: empleadoAutor?.empresa?.nombre_empresa || autor?.empresa?.nombre_empresa,
          depto: empleadoAutor?.cenco?.departamento?.nombre_departamento || "Sin Depto",
          cenco: empleadoAutor?.cenco?.nombre_cenco || "Sin Cenco",
          rut: autor?.run_usuario
        });

        await this.empleadoRepository.manager.save(registroEvento);
      }
    }
    // -----------------

    return buffer;
  }

  async generateAuditTurnoPdf(fechaInicio: string, fechaFin: string, numFichaStr: string, idUsuario?: number, ip?: string, userAgent?: string): Promise<Buffer> {
    const numFichas = numFichaStr.split(',').map(f => f.trim()).filter(f => f.length > 0);
    const contentArr: any[] = [
      { text: `REPORTE DE MODIFICACIONES Y/O ALTERACIONES DE TURNOS\n\nPeriodo: ${fechaInicio} hasta ${fechaFin}`, style: 'subheader', alignment: 'center', margin: [0, 10, 0, 10] }
    ];

    const formatDate = (d: any) => {
      if (!d) return 'N/A';
      const date = d instanceof Date ? d : new Date(d);
      const day = String(date.getUTCDate()).padStart(2, '0');
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const year = String(date.getUTCFullYear()).substring(2);
      return `${day}/${month}/${year}`;
    };

    for (let fIndex = 0; fIndex < numFichas.length; fIndex++) {
      const numFicha = numFichas[fIndex];
      const empleado = await this.empleadoRepository.findOne({
        where: { num_ficha: numFicha },
        relations: ['empresa', 'cargo', 'cenco', 'turno']
      });

      if (!empleado) continue;

      const dInicio = new Date(fechaInicio + 'T00:00:00');
      const dFin = new Date(fechaFin + 'T23:59:59');

      console.log(`[DEBUG] Buscando para ficha: ${numFicha}, desde: ${dInicio.toISOString()}, hasta: ${dFin.toISOString()}`);

      const query = this.auditoriaTurnoRepository.createQueryBuilder('audit');
      query.andWhere('audit.fecha_asignacion_turno >= :inicio', { inicio: dInicio });
      query.andWhere('audit.fecha_asignacion_turno <= :fin', { fin: dFin });
      query.andWhere('audit.run_empleado = :numFicha', { numFicha });

      const logs = await query.orderBy('audit.fecha_asignacion_turno', 'DESC').getMany();
      console.log(`[DEBUG] Auditoria logs encontrados:`, logs.length);
      if (logs.length > 0) {
        console.log(`[DEBUG] Primer log run_empleado: ${logs[0].run_empleado}, fecha: ${logs[0].fecha_asignacion_turno}`);
      }

      contentArr.push({
        columns: [
          { text: `Razón Social: ${empleado.empresa?.nombre_empresa?.toUpperCase() || 'N/A'}\nRUT Empresa: ${empleado.empresa?.rut_empresa || 'N/A'}\n`, width: '*', fontSize: 8 },
          { text: `Nombre: ${(empleado.nombres + ' ' + empleado.apellido_paterno + ' ' + empleado.apellido_materno).toUpperCase()}\nRUT: ${empleado.run}\nLugar de prestación de servicios: ${empleado.cenco?.nombre_cenco?.toUpperCase() || 'N/A'}`, width: '*', fontSize: 8 }
        ],
        margin: [0, 10, 0, 10]
      });

      if (!empleado.turno) {
        contentArr.push({ text: 'Este trabajador mantiene una jornada fija permanente (Sin sistema de turnos)', alignment: 'center', margin: [0, 20, 0, 20], bold: true });
      } else if (logs.length === 0) {
        contentArr.push({ text: 'Sin cambios o modificaciones en el periodo consultado', alignment: 'center', margin: [0, 20, 0, 20], bold: true });
      } else {
        const tableBody: any[] = [
          [
            { text: 'Fecha asignación turno', style: 'tableHeader' },
            { text: 'Detalle turno asignado', style: 'tableHeader' },
            { text: 'Extensión turno', style: 'tableHeader' },
            { text: 'Fecha asignación nuevo turno', style: 'tableHeader' },
            { text: 'Inicio de turno', style: 'tableHeader' },
            { text: 'Detalle nuevo turno asignado', style: 'tableHeader' },
            { text: 'Extensión nuevo turno', style: 'tableHeader' },
            { text: 'Solicitado por', style: 'tableHeader' },
            { text: 'Observaciones', style: 'tableHeader' }
          ]
        ];

        logs.forEach(log => {
          let solicitante = 'Empleador';
          if (log.solicitador_cambio && (log.solicitador_cambio.toLowerCase() === 'trabajador' || log.solicitador_cambio === empleado.num_ficha)) {
            solicitante = 'Trabajador';
          }

          tableBody.push([
            formatDate(log.fecha_asignacion_turno),
            `${log.hora_entrada || '--'} a ${log.hora_salida || '--'}`,
            log.extension_turno || 'Diario',
            formatDate(log.fecha_asignacion_turno),
            formatDate(log.inicio_turno),
            `${log.nuevo_hora_entrada || '--'} a ${log.nuevo_hora_salida || '--'}`,
            log.extension_nuevo_turno || 'Diario',
            solicitante,
            log.observaciones || ''
          ]);
        });

        contentArr.push({
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', '*'],
            body: tableBody
          }
        });
      }

      if (fIndex < numFichas.length - 1) {
        contentArr.push({
          canvas: [{ type: 'line', x1: 0, y1: 5, x2: 750, y2: 5, lineWidth: 0.5, lineColor: '#cccccc' }],
          margin: [0, 15, 0, 15]
        });
      }
    }

    const fonts = {
      Arial: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const docDefinition = {
      pageOrientation: 'landscape',
      content: contentArr,
      styles: {
        header: { fontSize: 8, bold: true },
        subheader: { fontSize: 8, bold: true, margin: [0, 5, 0, 5] },
        tableHeader: { bold: true, fontSize: 8, alignment: 'center' }
      },
      defaultStyle: { font: 'Arial', fontSize: 8, alignment: 'center' }
    };

    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    // --- AUDITORÍA ---
    if (idUsuario && !isNaN(idUsuario)) {
      const autor = await this.empleadoRepository.manager.findOne(User, {
        where: { usuario_id: idUsuario },
        relations: ['empleado', 'empresa']
      });

      if (autor) {
        let empleadoAutor: Empleado | null = null;
        if (autor?.empleado?.empleado_id) {
          empleadoAutor = await this.empleadoRepository.manager.findOne(Empleado, {
            where: { empleado_id: autor.empleado.empleado_id },
            relations: ['empresa', 'cenco', 'cenco.departamento']
          });
        }

        const parser = new UAParser(userAgent || '');
        const navegador = `${parser.getBrowser().name}-${parser.getBrowser().version}`;

        const registroEvento = this.empleadoRepository.manager.create(RegistroEvento, {
          usuario: autor?.username,
          evento: `El usuario ${autor?.username} de la empresa ${autor?.empresa?.nombre_empresa || 'Sin Empresa'} ha generado el reporte de Auditoría de Turnos para las fichas: ${numFichaStr} en el periodo ${fechaInicio} al ${fechaFin}`,
          tipo_evento: 'Reporte Auditoría Turnos',
          ip: ip || 'Desconocida',
          fecha: new Date(),
          hora: new Date().toTimeString().split(' ')[0],
          sistema_operativo: parser.getOS().name || 'Desconocido',
          browser: navegador,
          empresa: empleadoAutor?.empresa?.nombre_empresa || autor?.empresa?.nombre_empresa,
          depto: empleadoAutor?.cenco?.departamento?.nombre_departamento || "Sin Depto",
          cenco: empleadoAutor?.cenco?.nombre_cenco || "Sin Cenco",
          rut: autor?.run_usuario
        });

        await this.empleadoRepository.manager.save(registroEvento);
      }
    }
    // -----------------

    return buffer;
  }

  async generateDailyMarkingsPdf(fecha: string, idUsuario?: number, ip?: string, userAgent?: string): Promise<Buffer> {
    const marcas = await this.marcasService.findAll('', fecha, fecha);

    // Agrupar por empleado
    const groups = new Map<string, any>();
    marcas.forEach(m => {
      const ficha = m.empleado?.num_ficha || 'Sin ficha';
      if (!groups.has(ficha)) {
        groups.set(ficha, {
          empleado: m.empleado,
          marcas: []
        });
      }
      if (m.hora_marca) {
        groups.get(ficha).marcas.push(m);
      }
    });

    const contentArr: any[] = [
      { text: `REPORTE DIARIO DE MARCACIONES\n\nFecha: ${fecha}`, style: 'subheader', alignment: 'center', margin: [0, 10, 0, 10] }
    ];

    const tableBody: any[] = [
      [
        { text: 'Ficha', style: 'tableHeader' },
        { text: 'Nombre Trabajador', style: 'tableHeader' },
        { text: 'RUT', style: 'tableHeader' },
        { text: 'Hora Marca', style: 'tableHeader' },
        { text: 'Tipo', style: 'tableHeader' },
        { text: 'Dispositivo', style: 'tableHeader' }
      ]
    ];

    Array.from(groups.values()).forEach(g => {
      const emp = g.empleado;
      const nombre = emp ? `${emp.nombres} ${emp.apellido_paterno} ${emp.apellido_materno}` : 'N/A';
      const rut = emp ? emp.run : 'N/A';
      const ficha = emp ? emp.num_ficha : 'N/A';

      if (g.marcas.length === 0) {
        tableBody.push([ficha, nombre, rut, 'Sin marcas', '-', '-']);
      } else {
        g.marcas.forEach((m: any, idx: number) => {
          tableBody.push([
            idx === 0 ? ficha : '',
            idx === 0 ? nombre : '',
            idx === 0 ? rut : '',
            m.hora_marca,
            m.evento === 1 ? 'Entrada' : 'Salida',
            m.dispositivo?.nombre || 'N/A'
          ]);
        });
      }
    });

    contentArr.push({
      table: {
        headerRows: 1,
        widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto'],
        body: tableBody
      }
    });

    const fonts = {
      Arial: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    const docDefinition = {
      pageOrientation: 'portrait',
      content: contentArr,
      styles: {
        header: { fontSize: 8, bold: true },
        subheader: { fontSize: 9, bold: true, margin: [0, 5, 0, 5] },
        tableHeader: { bold: true, fontSize: 8, alignment: 'center' }
      },
      defaultStyle: { font: 'Arial', fontSize: 8 }
    };

    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    // --- AUDITORÍA ---
    if (idUsuario && !isNaN(idUsuario)) {
      const autor = await this.empleadoRepository.manager.findOne(User, {
        where: { usuario_id: idUsuario },
        relations: ['empleado', 'empresa']
      });

      if (autor) {
        let empleadoAutor: Empleado | null = null;
        if (autor?.empleado?.empleado_id) {
          empleadoAutor = await this.empleadoRepository.manager.findOne(Empleado, {
            where: { empleado_id: autor.empleado.empleado_id },
            relations: ['empresa', 'cenco', 'cenco.departamento']
          });
        }

        const parser = new UAParser(userAgent || '');
        const navegador = `${parser.getBrowser().name}-${parser.getBrowser().version}`;

        const registroEvento = this.empleadoRepository.manager.create(RegistroEvento, {
          usuario: autor?.username,
          evento: `El usuario ${autor?.username} de la empresa ${autor?.empresa?.nombre_empresa || 'Sin Empresa'} ha generado el reporte de Marcaciones Diarias para la fecha ${fecha}`,
          tipo_evento: 'Reporte Marcaciones Diarias',
          ip: ip || 'Desconocida',
          fecha: new Date(),
          hora: new Date().toTimeString().split(' ')[0],
          sistema_operativo: parser.getOS().name || 'Desconocido',
          browser: navegador,
          empresa: empleadoAutor?.empresa?.nombre_empresa || autor?.empresa?.nombre_empresa,
          depto: empleadoAutor?.cenco?.departamento?.nombre_departamento || "Sin Depto",
          cenco: empleadoAutor?.cenco?.nombre_cenco || "Sin Cenco",
        });

        await this.empleadoRepository.manager.save(registroEvento);
      }
    }

    return buffer;
  }

  async reporteConexiones(fechaInicio: string, fechaFin: string, idEmpresa?: number, idUsuarioFiltro?: number, idUsuarioAuditoria?: number, ip?: string, userAgent?: string): Promise<Buffer> {
    const empresas = await this.empresaRepository.find();
    const empresaMap = new Map(empresas.map(e => [e.empresa_id, e.nombre_empresa]));
    let usuarioFiltro: User | null = null;
    if (idUsuarioFiltro) {
      usuarioFiltro = await this.userRepository.findOne({ where: { usuario_id: idUsuarioFiltro } });
    }

    const where: any = {
      fecha: Between(
        new Date(`${fechaInicio}T00:00:00`),
        new Date(`${fechaFin}T23:59:59`)
      )
    };

    if (idEmpresa) {
      where.empresa = { empresa_id: idEmpresa };
    }
    if (idUsuarioFiltro) {
      where.idusuario = { usuario_id: idUsuarioFiltro };
    }

    const conexiones = await this.registroConexioneRepository.find({
      where,
      relations: ['empresa', 'idusuario'],
      order: { fecha: 'DESC', hora: 'DESC' }
    });

    let tituloReporte = 'REPORTE GENERAL DE REGISTRO DE CONEXIONES';
    if (idEmpresa && !idUsuarioFiltro) {
      tituloReporte = `REPORTE DE REGISTRO DE CONEXIONES\nEMPRESA: ${empresaMap.get(Number(idEmpresa)) || 'Desconocida'}`;
    } else if (idUsuarioFiltro) {
      tituloReporte = `REPORTE DE REGISTRO DE CONEXIONES\nUSUARIO: ${usuarioFiltro?.username || 'Desconocido'}`;
      if (idEmpresa) tituloReporte += `\nEMPRESA: ${empresaMap.get(Number(idEmpresa)) || ''}`;
    }

    const fInicioFormateada = fechaInicio.split('-').reverse().join('-');
    const fFinFormateada = fechaFin.split('-').reverse().join('-');

    const contentArr: any[] = [
      { text: `${tituloReporte}\n\nPeriodo: ${fInicioFormateada} hasta ${fFinFormateada}`, style: 'subheader', alignment: 'center', margin: [0, 10, 0, 10] }
    ];

    const body: any[][] = [
      [
        { text: 'Fecha', style: 'tableHeader' },
        { text: 'Hora', style: 'tableHeader' },
        { text: 'Usuario', style: 'tableHeader' },
        { text: 'Correo', style: 'tableHeader' },
        { text: 'RUT', style: 'tableHeader' },
        { text: 'IP', style: 'tableHeader' },
        { text: 'Empresa', style: 'tableHeader' }
      ]
    ];

    conexiones.forEach(con => {
      body.push([
        new Date(con.fecha).toLocaleDateString('es-CL'),
        con.hora,
        con.username || '---',
        con.correo,
        con.rut,
        con.ip,
        con.empresa?.nombre_empresa || 'Desconocida'
      ]);
    });

    contentArr.push({
      table: {
        headerRows: 1,
        widths: ['auto', 'auto', 'auto', '*', 'auto', 'auto', 'auto'],
        body: body
      },
      layout: 'lightHorizontalLines'
    });

    const docDefinition = {
      content: contentArr,
      styles: {
        header: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        tableHeader: { bold: true, fontSize: 12, color: 'black' }
      },
      defaultStyle: { font: 'Arial', fontSize: 10 }
    };

    const fonts = {
      Arial: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
      }
    };

    pdfmake.setFonts(fonts);
    const pdfDoc = pdfmake.createPdf(docDefinition);
    const buffer = await pdfDoc.getBuffer();

    // --- AUDITORÍA ---
    if (idUsuarioAuditoria) {
      const autor = await this.userRepository.findOne({
        where: { usuario_id: idUsuarioAuditoria },
        relations: ['empleado', 'empresa']
      });

      if (autor) {
        let empleadoAutor: Empleado | null = null;
        if (autor?.empleado?.empleado_id) {
          empleadoAutor = await this.empleadoRepository.manager.findOne(Empleado, {
            where: { empleado_id: autor.empleado.empleado_id },
            relations: ['empresa', 'cenco', 'cenco.departamento']
          });
        }

        const parser = new UAParser(userAgent || '');
        const navegador = `${parser.getBrowser().name}-${parser.getBrowser().version}`;

        const registroEvento = this.empleadoRepository.manager.create(RegistroEvento, {
          usuario: autor?.username,
          evento: `El usuario ${autor?.username} de la empresa ${autor?.empresa?.nombre_empresa || 'Sin Empresa'} ha generado el reporte General de Registro de Conexiones desde ${fechaInicio} hasta ${fechaFin}`,
          tipo_evento: 'Reporte Registro Conexiones',
          ip: ip || 'Desconocida',
          fecha: new Date(),
          hora: new Date().toTimeString().split(' ')[0],
          sistema_operativo: parser.getOS().name || 'Desconocido',
          browser: navegador,
          empresa: empleadoAutor?.empresa?.nombre_empresa || autor?.empresa?.nombre_empresa,
          depto: empleadoAutor?.cenco?.departamento?.nombre_departamento || "Sin Depto",
          cenco: empleadoAutor?.cenco?.nombre_cenco || "Sin Cenco",
          rut: autor?.run_usuario
        });

        await this.empleadoRepository.manager.save(registroEvento);
      }
    }

    return buffer;
  }
}
