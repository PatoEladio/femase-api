import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VacacionesProgresivasService } from './vacaciones-progresivas.service';
import { CreateVacacionesProgresivasDto } from './dto/vacaciones-progresivas.dto';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('vacaciones-progresivas')
@UseGuards(AuthGuard)
export class VacacionesProgresivasController {
  constructor(
    private readonly vacacionesProgresivasService: VacacionesProgresivasService,
  ) {}

  /**
   * GET /vacaciones-progresivas/preview?numFicha=XXX
   * Calcula y devuelve (sin guardar) los días progresivos actuales del empleado.
   */
  @Get('preview')
  calcularPreview(@Query('numFicha') numFicha: string) {
    return this.vacacionesProgresivasService.calcularPreview(numFicha);
  }

  /**
   * GET /vacaciones-progresivas/reporte?empresaId=1&page=1&limit=20
   * Listado de todos los empleados con sus días progresivos (reporte admin).
   */
  @Get('reporte')
  getReporte(
    @Query('empresaId') empresaId?: number,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.vacacionesProgresivasService.getReporteProgresivoPorEmpresa(
      empresaId,
      page,
      limit,
    );
  }

  /**
   * GET /vacaciones-progresivas?numFicha=XXX
   * Devuelve los días progresivos actuales + historial de cortes del empleado.
   */
  @Get()
  getDiasProgresivos(@Query('numFicha') numFicha: string) {
    return this.vacacionesProgresivasService.getDiasProgresivosByFicha(
      numFicha,
    );
  }

  /**
   * POST /vacaciones-progresivas/corte
   * Registra un corte manual de vacaciones progresivas para un empleado.
   */
  @Post('corte')
  registrarCorte(@Body() dto: CreateVacacionesProgresivasDto) {
    return this.vacacionesProgresivasService.registrarCorteProgresivo(dto);
  }

  /**
   * DELETE /vacaciones-progresivas/corte/:id
   * Elimina un registro del historial de cortes.
   */
  @Delete('corte/:id')
  eliminarCorte(@Param('id') id: string) {
    return this.vacacionesProgresivasService.eliminarCorte(+id);
  }
}
