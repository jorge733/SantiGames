// Catálogo de SantiGames. Para publicar un juego nuevo, añade un objeto a "juegos".
// estado: 'disponible' o 'desarrollo'. Solo un juego debería tener destacado: true.
window.SANTIGAMES = {
  // Escribe aquí el correo público del estudio para que aparezca en la página "El estudio".
  contacto: 'sabenedettoa@benedettowebs.cl',
  juegos: [
    {
      titulo: 'Cielo Abierto',
      genero: 'Simulador de vuelo 3D',
      resumen: 'Pilota la avioneta de la aerolínea Cielo Abierto sobre una isla low-poly: lleva a tus pasajeros entre montañas y aterriza tan suave que te aplaudan.',
      estado: 'disponible',
      plataforma: 'Navegador · teclado o táctil',
      portada: 'juegos/cielo-abierto/portada.svg',
      ficha: 'juegos/cielo-abierto/index.html',
      jugar: 'juegos/cielo-abierto/jugar.html',
      destacado: true,
    },
  ],
};
