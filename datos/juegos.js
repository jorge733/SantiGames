// Catálogo de SantiGames. Para publicar un juego nuevo, añade un objeto a "juegos".
// estado: 'disponible' o 'desarrollo'. Solo un juego debería tener destacado: true.
window.SANTIGAMES = {
  // Escribe aquí el correo público del estudio para que aparezca en la página "El estudio".
  contacto: 'sabenedettoa@benedettowebs.cl',
  juegos: [
    {
      titulo: 'Cielo Abierto',
      genero: 'Simulador de vuelo 3D',
      resumen: 'Dirige la aerolínea Benedetto y vuela desde Santiago a 24 ciudades reales de Chile y del mundo: despega, cruza el mapa y aterriza tan suave que tus pasajeros te aplaudan.',
      estado: 'disponible',
      plataforma: 'Navegador · teclado o táctil',
      portada: 'juegos/cielo-abierto/portada.svg',
      ficha: 'juegos/cielo-abierto/index.html',
      jugar: 'juegos/cielo-abierto/jugar.html',
      destacado: true,
    },
    {
      titulo: 'TaxiSim',
      genero: 'Simulador de taxi',
      resumen: 'Maneja un taxi por Ciudad Benedetto de 08:00 a 20:00: recoge pasajeros, llévalos a tiempo, esquiva el tráfico y ahorra para mejorar tu auto.',
      estado: 'disponible',
      plataforma: 'Navegador · teclado o táctil',
      portada: 'juegos/taxisim/portada.svg',
      ficha: 'juegos/taxisim/index.html',
      jugar: 'juegos/taxisim/jugar.html',
    },
  ],
};
