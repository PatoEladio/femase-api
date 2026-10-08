import { Empleado } from 'src/empleado/entities/empleado.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ schema: 'db_fmc', name: 'vacaciones_progresivas' })
export class VacacionesProgresivas {
  @PrimaryGeneratedColumn()
  id_vp: number;

  /** Años de servicio cumplidos en el mismo empleador al momento del registro */
  @Column({ type: 'int' })
  anios_cumplidos: number;

  /** Días progresivos acumulados totales hasta este corte */
  @Column({ type: 'int' })
  dias_progresivos: number;

  /** Fecha en la que se registró / calculó este corte */
  @Column({ type: 'date' })
  fecha_calculo: Date;

  /** Observación libre (puede quedar null) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  observacion: string | null;

  @CreateDateColumn()
  fecha_ingreso: Date;

  @ManyToOne(() => Empleado, (empleado) => empleado.vacaciones_progresivas)
  @JoinColumn({ name: 'id_empleado' })
  empleado: Empleado;
}
