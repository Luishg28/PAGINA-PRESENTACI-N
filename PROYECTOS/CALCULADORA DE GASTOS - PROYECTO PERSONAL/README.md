# Mi Control Financiero

Aplicación responsive para organizar ingresos, gastos, ahorros, deudas y presupuestos por mes y quincena.

## Funciones

- Resumen mensual y por quincena.
- Categorías de movimientos.
- Presupuesto mensual con indicador de consumo.
- Proyección de seis meses.
- Búsqueda y filtros.
- Exportación e importación de copias de seguridad.
- Modo local con `localStorage`.
- Persistencia opcional con PHP y MySQL.
- PWA instalable en Android, iPhone y escritorio.

## Uso rápido sin base de datos

Abre `index.html`. Los datos se guardan únicamente en ese navegador.

Para habilitar instalación PWA y funcionamiento sin conexión, sirve la carpeta mediante HTTP:

```powershell
php -S 0.0.0.0:8080
```

Luego abre `http://localhost:8080`.

## Uso con Docker

1. Cambia las dos contraseñas de `docker-compose.yml`.
2. Desde esta carpeta ejecuta:

```powershell
docker compose up -d --build
```

3. Abre `http://localhost:8080`.

Para detener:

```powershell
docker compose down
```

Los datos de MySQL permanecen en el volumen `control_financiero_data`.

## Abrir desde el celular

### En la misma red Wi-Fi

1. Inicia la app con Docker o `php -S 0.0.0.0:8080`.
2. Obtén la IP local de la laptop con `ipconfig`.
3. En el celular abre `http://IP-DE-TU-LAPTOP:8080`.
4. Si Windows pregunta, permite el acceso solo en redes privadas.

### Desde otra red

Docker no publica la aplicación en Internet por sí solo. Para uso personal se recomienda una red privada como Tailscale:

1. Instala Tailscale en la laptop y el celular.
2. Inicia la app en el puerto `8080`.
3. Accede usando la IP privada de Tailscale o configura Tailscale Serve.

No expongas directamente el puerto del router: esta app no incluye cuentas de usuario y contiene información financiera personal.

## MySQL con XAMPP

1. Coloca la carpeta en `C:\xampp\htdocs\control-financiero`.
2. Inicia Apache y MySQL.
3. Importa `database.sql` en phpMyAdmin.
4. Abre `http://localhost/control-financiero/`.

Las credenciales pueden configurarse con `DB_HOST`, `DB_NAME`, `DB_USER` y `DB_PASS`.

## Seguridad

- La API valida tipos, montos, días, meses e identificadores.
- Las consultas usan PDO y procedimientos preparados.
- Los errores internos se escriben en el registro del servidor y no se muestran al navegador.
- Realiza copias de seguridad periódicas desde la propia aplicación.
