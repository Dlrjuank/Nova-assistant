import { consultar } from '@/lib/db/conexion';

/** La consulta más pequeña posible: cuenta como actividad para que Supabase no pause el proyecto (plan, 13). */
export async function comprobarBase(): Promise<void> {
  await consultar('SELECT 1');
}
