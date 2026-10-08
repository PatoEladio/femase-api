import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateVacacionesProgresivasDto {
  /** Número de ficha del empleado */
  @IsNotEmpty()
  @IsString()
  numFicha: string;

  /** Observación opcional */
  @IsOptional()
  @IsString()
  observacion?: string;
}

export class UpdateVacacionesProgresivasDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  dias_progresivos?: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}
