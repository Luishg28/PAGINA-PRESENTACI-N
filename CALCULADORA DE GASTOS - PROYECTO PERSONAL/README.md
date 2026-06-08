# Control Financiero

App web para organizar ingresos, gastos y deudas por mes y por quincena.

## Uso rapido sin BD

Abre `index.html` con doble clic. En este modo los datos se guardan en el navegador con `localStorage`.

## Uso con XAMPP y MySQL

1. Copia esta carpeta dentro de `C:\xampp\htdocs\control-financiero`.
2. Inicia Apache y MySQL desde XAMPP.
3. Abre `http://localhost/phpmyadmin`.
4. Importa el archivo `database.sql`.
5. Abre `http://localhost/control-financiero/index.html`.

Cuando la API PHP responde correctamente, la app muestra `MySQL activo` y usa la BD.

## Archivos importantes

- `database.sql`: tablas, datos iniciales y procedimientos almacenados CRUD.
- `api.php`: endpoints PHP que llaman a los procedimientos almacenados.
- `config.php`: credenciales de MySQL.
- `index.html`, `styles.css`, `app.js`: interfaz, estilos y logica.
