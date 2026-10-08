import { HttpException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VacacionesProgresivas } from './entities/vacaciones-progresivas.entity';
import { Empleado } from '../empleado/entities/empleado.entity';
import { CreateVacacionesProgresivasDto } from './dto/vacaciones-progresivas.dto';

/**
 * ─── REGLA LEGAL (Art. 68 Código del Trabajo de Chile) ─────────────────────
 *
 *  • El trabajador tiene derecho a 1 día hábil adicional de vacaciones
 *    por cada 3 años trabajados con el mismo empleador, por sobre los
 *    10 años de servicio.
 *
 *  Ejemplo de acumulación:
 *    Años 0–9  → 0 días progresivos
 *    Año  10   → 0 días progresivos  (el primer tramo de 3 comienza a contar)
 *    Año  13   → +1 día              (3 años extras sobre el año 10)
 *    Año  16   → +2 días             (6 años extras sobre el año 10)
 *    Año  19   → +3 días             (9 años extras …)
 *    …
 *
 *  La fórmula es: diasProgresivos = floor((añosTotales - 10) / 3)
 *  con un mínimo de 0.
 * ────────────────────────────────────────────────────────────────────────────
 */
@Injectable()
export class VacacionesProgresivasService {
  constructor(
    @InjectRepository(VacacionesProgresivas)
    private readonly vpRepository: Repository<VacacionesProgresivas>,
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // Helpers internos
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Calcula los años completos de servicio desde fecha_ini_contrato hasta hoy.
   */
  private calcularAniosServicio(fechaInicio: Date): number {
    const inicio = new Date(fechaInicio);
    const hoy = new Date();

    let anios =
      hoy.getFullYear() -
      inicio.getFullYear() -
      (hoy <
      new Date(hoy.getFullYear(), inicio.getMonth(), inicio.getDate())
        ? 1
        : 0);

    return Math.max(anios, 0);
  }

  /**
   * Aplica la fórmula legal y devuelve los días progresivos que corresponden
   * a los años de servicio indicados.
   */
  private calcularDiasProgresivos(aniosServicio: number): number {
    if (aniosServicio < 10) return 0;
    return Math.floor((aniosServicio - 10) / 3);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Endpoints públicos
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Devuelve los días progresivos actuales de un empleado junto con
   * el historial de registros guardados en la tabla.
   */
  async getDiasProgresivosByFicha(numFicha: string) {
    const empleado = await this.empleadoRepository.findOne({
      where: { num_ficha: numFicha },
      relations: ['cenco'],
    });

    if (!empleado) {
      throw new HttpException('Empleado no encontrado', 404);
    }

    const aniosServicio = this.calcularAniosServicio(
      empleado.fecha_ini_contrato,
    );
    const diasProgresivosActuales = this.calcularDiasProgresivos(aniosServicio);

    const historial = await this.vpRepository.find({
      where: { empleado: { empleado_id: empleado.empleado_id } },
      order: { anios_cumplidos: 'DESC' },
      select: {
        id_vp: true,
        anios_cumplidos: true,
        dias_progresivos: true,
        fecha_calculo: true,
        observacion: true,
        fecha_ingreso: true,
      },
    });

    return {
      empleado: {
        num_ficha: empleado.num_ficha,
        nombres: empleado.nombres,
        apellido_paterno: empleado.apellido_paterno,
        apellido_materno: empleado.apellido_materno,
        run: empleado.run,
        fecha_ini_contrato: empleado.fecha_ini_contrato,
      },
      calculo: {
        aniosServicio,
        diasProgresivosActuales,
        proximoTramo:
          aniosServicio >= 10
            ? 10 + Math.ceil((aniosServicio - 10 + 1) / 3) * 3
            : 10,
        aniosParaProximoTramo:
          aniosServicio >= 10
            ? 3 - ((aniosServicio - 10) % 3)
            : 10 - aniosServicio,
      },
      historial,
    };
  }

  /**
   * Obtiene los días progresivos de todos los empleados de una empresa,
   * con paginación. Útil para reportes administrativos.
   */
  async getReporteProgresivoPorEmpresa(
    empresaId?: number,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.empleadoRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.empresa', 'empresa')
      .leftJoinAndSelect('e.cenco', 'cenco')
      .leftJoinAndSelect('cenco.departamento', 'departamento')
      .where('e.fecha_ini_contrato IS NOT NULL');

    if (empresaId) {
      queryBuilder.andWhere('empresa.empresa_id = :empresaId', { empresaId });
    }

    const [empleados, total] = await queryBuilder
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const resultado = empleados.map((emp) => {
      const aniosServicio = this.calcularAniosServicio(emp.fecha_ini_contrato);
      const diasProgresivos = this.calcularDiasProgresivos(aniosServicio);

      return {
        num_ficha: emp.num_ficha,
        nombres: emp.nombres,
        apellido_paterno: emp.apellido_paterno,
        apellido_materno: emp.apellido_materno,
        run: emp.run,
        fecha_ini_contrato: emp.fecha_ini_contrato,
        empresa: emp.empresa?.nombre_empresa,
        cenco: emp.cenco?.nombre_cenco,
        departamento: emp.cenco?.departamento?.nombre_departamento,
        aniosServicio,
        diasProgresivos,
        tieneProgresivos: diasProgresivos > 0,
      };
    });

    return {
      data: resultado,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Registra manualmente un corte de vacaciones progresivas para un empleado.
   * El sistema calcula automáticamente los años de servicio y días progresivos
   * basándose en la fecha de inicio de contrato del empleado.
   */
  async registrarCorteProgresivo(
    dto: CreateVacacionesProgresivasDto,
  ) {
    const empleado = await this.empleadoRepository.findOne({
      where: { num_ficha: dto.numFicha },
    });

    if (!empleado) {
      throw new HttpException('Empleado no encontrado', 404);
    }

    const aniosServicio = this.calcularAniosServicio(
      empleado.fecha_ini_contrato,
    );
    const diasProgresivos = this.calcularDiasProgresivos(aniosServicio);

    const nuevoCorte = this.vpRepository.create({
      empleado,
      anios_cumplidos: aniosServicio,
      dias_progresivos: diasProgresivos,
      fecha_calculo: new Date(),
      observacion: dto.observacion ?? null,
    });

    return this.vpRepository.save(nuevoCorte);
  }

  /**
   * Elimina un registro específico del historial de cortes progresivos.
   */
  async eliminarCorte(idVp: number) {
    const registro = await this.vpRepository.findOne({
      where: { id_vp: idVp },
    });

    if (!registro) {
      throw new HttpException('Registro no encontrado', 404);
    }

    await this.vpRepository.remove(registro);
    return { message: 'Registro eliminado correctamente' };
  }

  /**
   * Calcula (sin guardar) los días progresivos para cualquier num_ficha.
   * Útil para previsualizarlos en el frontend antes de aprobar vacaciones.
   */
  async calcularPreview(numFicha: string) {
    const empleado = await this.empleadoRepository.findOne({
      where: { num_ficha: numFicha },
    });

    if (!empleado) {
      throw new HttpException('Empleado no encontrado', 404);
    }

    const aniosServicio = this.calcularAniosServicio(
      empleado.fecha_ini_contrato,
    );
    const diasProgresivos = this.calcularDiasProgresivos(aniosServicio);

    return {
      numFicha: empleado.num_ficha,
      nombres: `${empleado.nombres} ${empleado.apellido_paterno}`,
      aniosServicio,
      diasProgresivos,
      detalle:
        aniosServicio < 10
          ? `El empleado lleva ${aniosServicio} año(s). Los días progresivos comienzan a partir del año 10 de servicio con el mismo empleador.`
          : `Con ${aniosServicio} año(s) de servicio, corresponden ${diasProgresivos} día(s) progresivo(s) (1 día por cada 3 años sobre el año 10).`,
    };
  }
}
