function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function plantillaRecuperacion(enlace: string): string {
  const enlaceSeguro = escaparHtml(enlace);

  return `
    <div style="margin:0 auto;max-width:560px;padding:32px 20px;font-family:Arial,sans-serif;color:#e2e8f0;background:#0b1020;border-radius:16px">
      <h1 style="margin:0 0 16px;color:#fff;font-size:24px">Restablece tu contraseña</h1>
      <p style="margin:0 0 24px;line-height:1.6">Recibimos una solicitud para cambiar la contraseña de tu cuenta de NovaAssistant.</p>
      <p style="margin:0 0 24px">
        <a href="${enlaceSeguro}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#3b82f6;color:#fff;text-decoration:none;font-weight:bold">Crear nueva contraseña</a>
      </p>
      <p style="margin:0 0 12px;line-height:1.6">Este enlace vence en 30 minutos.</p>
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6">Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
    </div>
  `;
}
