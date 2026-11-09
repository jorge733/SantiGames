// Catálogo de SantiGames. Para publicar un juego nuevo, añade un objeto a "juegos".
// estado: 'disponible' o 'desarrollo'. Solo un juego debería tener destacado: true.
window.SANTIGAMES = {
  // Escribe aquí el correo público del estudio para que aparezca en la página "El estudio".
  contacto: 'sabenedettoa@benedettowebs.cl',
  juegos: [
    {
      titulo: 'Cielo Abierto',
      genero: 'Simulador de vuelo 3D',
      resumen: 'Pilota una avioneta sobre una isla low-poly: despega, cruza las montañas y demuestra que sabes aterrizar.',
      estado: 'disponible',
      plataforma: 'Navegador · teclado',
      portada: 'juegos/cielo-abierto/portada.svg',
      ficha: 'juegos/cielo-abierto/index.html',
      jugar: 'juegos/cielo-abierto/jugar.html',
      destacado: true,
    },
  ],
};
