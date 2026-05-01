/* Spain location hierarchy — Province → City → Zone */
var LOCATIONS_ES = {

  provinces: [
    'A Coruña','Álava','Albacete','Alicante','Almería','Asturias','Ávila','Badajoz',
    'Illes Balears','Barcelona','Burgos','Cáceres','Cádiz','Cantabria','Castellón',
    'Ceuta','Ciudad Real','Córdoba','Cuenca','Gipuzkoa','Girona','Granada','Guadalajara',
    'Huelva','Huesca','Jaén','León','Lleida','La Rioja','Lugo','Madrid','Málaga',
    'Melilla','Murcia','Navarra','Ourense','Palencia','Las Palmas','Pontevedra',
    'Salamanca','Santa Cruz de Tenerife','Segovia','Sevilla','Soria','Tarragona',
    'Teruel','Toledo','Valencia','Valladolid','Vizcaya','Zamora','Zaragoza',
    /* ── USA ── */
    'Florida'
  ],

  cities: {
    'A Coruña': ['A Coruña','Santiago de Compostela','Ferrol','Betanzos','Carballo','Narón','Oleiros','Arteixo','Cambre','Culleredo','Boiro','Ribeira','Vilagarcía de Arousa'],
    'Álava': ['Vitoria-Gasteiz','Llodio','Amurrio','Salvatierra','Laudio'],
    'Albacete': ['Albacete','Hellín','Almansa','Villarrobledo','La Roda','Caudete'],
    'Alicante': ['Alicante','Benidorm','Torrevieja','Orihuela','Elche','Elda','San Vicente del Raspeig','Villajoyosa','Alfàs del Pi','Calpe','Dénia','Xàbia','Altea','Teulada','Guardamar del Segura','Santa Pola','Pilar de la Horadada'],
    'Almería': ['Almería','El Ejido','Roquetas de Mar','Vícar','Adra','Níjar','Vera','Mojácar','Garrucha'],
    'Asturias': ['Oviedo','Gijón','Avilés','Siero','Langreo','Mieres','Castrillón','Gozón','Villaviciosa','Llanes','Cangas de Onís'],
    'Ávila': ['Ávila','Arévalo','Las Navas del Marqués','El Escorial'],
    'Badajoz': ['Badajoz','Mérida','Don Benito','Villanueva de la Serena','Almendralejo','Plasencia'],
    'Illes Balears': ['Palma','Calvià','Llucmajor','Marratxí','Manacor','Inca','Sóller','Andratx','Pollença','Alcúdia','Ibiza','Santa Eulària des Riu','Sant Antoni de Portmany','Sant Josep de sa Talaia','Sant Joan de Labritja','Formentera','Maó','Ciutadella de Menorca','Es Castell','Sant Lluís'],
    'Barcelona': ['Barcelona','L\'Hospitalet de Llobregat','Badalona','Terrassa','Sabadell','Mataró','Sant Cugat del Vallès','Cornellà de Llobregat','Sant Boi de Llobregat','El Prat de Llobregat','Rubí','Cerdanyola del Vallès','Granollers','Mollet del Vallès','Castelldefels','Gavà','Viladecans','Sitges','Esplugues de Llobregat','Sant Feliu de Llobregat','Vilanova i la Geltrú','Vilafranca del Penedès','Cardedeu','Calella','Premià de Mar','Alella'],
    'Burgos': ['Burgos','Aranda de Duero','Miranda de Ebro'],
    'Cáceres': ['Cáceres','Plasencia','Mérida','Navalmoral de la Mata'],
    'Cádiz': ['Cádiz','Jerez de la Frontera','Algeciras','San Fernando','El Puerto de Santa María','Sanlúcar de Barrameda','Chiclana de la Frontera','La Línea de la Concepción','Conil de la Frontera','Barbate','Tarifa','Vejer de la Frontera'],
    'Cantabria': ['Santander','Camargo','El Astillero','Santa Cruz de Bezana','Piélagos','Torrelavega','Castro-Urdiales','Laredo','San Vicente de la Barquera','Comillas'],
    'Castellón': ['Castellón de la Plana','Vila-real','Benicarló','Vinaròs','Benicàssim','Peñíscola','Oropesa del Mar','Alcalà de Xivert'],
    'Ceuta': ['Ceuta'],
    'Ciudad Real': ['Ciudad Real','Puertollano','Alcázar de San Juan','Tomelloso','Valdepeñas','Manzanares'],
    'Córdoba': ['Córdoba','Lucena','Montilla','Puente Genil','Priego de Córdoba','Baena'],
    'Cuenca': ['Cuenca','Tarancón','San Clemente'],
    'Gipuzkoa': ['San Sebastián','Irun','Errenteria','Hernani','Donostia','Zarautz','Hondarribia','Tolosa'],
    'Girona': ['Girona','Lloret de Mar','Blanes','Figueres','Roses','Palafrugell','Begur','Platja d\'Aro','Sant Feliu de Guíxols','Cadaqués','L\'Escala','Torroella de Montgrí','Empuriabrava','Sant Pere Pescador','Olot','Banyoles','Ripoll','Puigcerdà'],
    'Granada': ['Granada','Motril','Almuñécar','Salobreña','Guadix','Baza','Loja','La Herradura','Nerja','Marbella'],
    'Guadalajara': ['Guadalajara','Azuqueca de Henares','Cabanillas del Campo','Alovera','Marchamalo'],
    'Huelva': ['Huelva','Almonte','Isla Cristina','Ayamonte','Lepe','Moguer','Punta Umbría'],
    'Huesca': ['Huesca','Jaca','Sabiñánigo','Monzón','Barbastro','Benasque'],
    'Jaén': ['Jaén','Linares','Andújar','Úbeda','Baeza','Alcalá la Real'],
    'León': ['León','Ponferrada','San Andrés del Rabanedo','Astorga','La Bañeza'],
    'Lleida': ['Lleida','Mollerussa','Tàrrega','Balaguer','Cervera','Sort','La Seu d\'Urgell','Vielha e Mijaran'],
    'La Rioja': ['Logroño','Calahorra','Arnedo','Haro','Santo Domingo de la Calzada'],
    'Lugo': ['Lugo','Monforte de Lemos','Sarria','Viveiro','Ribadeo'],
    'Madrid': ['Madrid','Pozuelo de Alarcón','Majadahonda','Las Rozas de Madrid','Alcobendas','San Sebastián de los Reyes','Alcalá de Henares','Torrejón de Ardoz','Getafe','Leganés','Móstoles','Fuenlabrada','Alcorcón','Tres Cantos','Boadilla del Monte','Villanueva de la Cañada','Brunete','El Escorial','Villanueva del Pardillo','Collado Villalba','Galapagar','Torrelodones','Hoyo de Manzanares','Alpedrete','Moralzarzal','Manzanares el Real','Rivas-Vaciamadrid','Arganda del Rey','Coslada'],
    'Málaga': ['Málaga','Marbella','Fuengirola','Benalmádena','Torremolinos','Estepona','Nerja','Mijas','Benahavís','Ronda','Antequera','Vélez-Málaga','Torre del Mar','Alhaurín el Grande','Alhaurín de la Torre','Coín','Manilva','Casares','Frigiliana'],
    'Melilla': ['Melilla'],
    'Murcia': ['Murcia','Cartagena','Lorca','Molina de Segura','Alcantarilla','Mazarrón','San Javier','San Pedro del Pinatar','Torre-Pacheco','La Manga del Mar Menor','Los Alcázares','Puerto Lumbreras'],
    'Navarra': ['Pamplona','Tudela','Barañáin','Burlada','Villava','Estella','Sangüesa'],
    'Ourense': ['Ourense','Verín','Barco de Valdeorras','O Barco'],
    'Palencia': ['Palencia','Guardo','Aguilar de Campoo','Venta de Baños'],
    'Las Palmas': ['Las Palmas de Gran Canaria','Telde','Arucas','Ingenio','Santa Lucía de Tirajana','San Bartolomé de Tirajana','Maspalomas','Puerto Rico','Playa del Inglés','Mogán','Agüimes','Arrecife','Puerto del Carmen','Costa Teguise','Playa Blanca','Corralejo','El Cotillo'],
    'Pontevedra': ['Vigo','Pontevedra','Vilagarcía de Arousa','Redondela','Marín','O Porriño','Sanxenxo','Cangas','Baiona','Nigran','Moaña'],
    'Salamanca': ['Salamanca','Béjar','Ciudad Rodrigo','Carbajosa de la Sagrada'],
    'Santa Cruz de Tenerife': ['Santa Cruz de Tenerife','San Cristóbal de La Laguna','La Orotava','Puerto de la Cruz','Arona','Adeje','Los Llanos de Aridane','Granadilla de Abona','El Médano','Costa Adeje','Playa de las Américas','Los Cristianos','Callao Salvaje','Santiago del Teide','Icod de los Vinos','Garachico'],
    'Segovia': ['Segovia','El Espinar','San Ildefonso','Cuéllar'],
    'Sevilla': ['Sevilla','Dos Hermanas','Alcalá de Guadaíra','Mairena del Aljarafe','Bormujos','Coria del Río','Sanlúcar la Mayor','Castilleja de la Cuesta','Écija','Carmona','Utrera','Morón de la Frontera'],
    'Soria': ['Soria','Almazán','Burgo de Osma'],
    'Tarragona': ['Tarragona','Reus','Salou','Cambrils','Vila-seca','Calafell','Altafulla','Torredembarra','El Vendrell','Amposta','Tortosa','L\'Ametlla de Mar','L\'Hospitalet de l\'Infant'],
    'Teruel': ['Teruel','Alcañiz','Calamocha'],
    'Toledo': ['Toledo','Talavera de la Reina','Illescas','Madridejos','Getafe','Seseña'],
    'Valencia': ['Valencia','Torrent','Gandía','Paterna','Sagunto','Benidorm','Alzira','Mislata','Quart de Poblet','Xirivella','Xàtiva','Oliva','Dénia','Calpe','Xàbia','Cullera','Sueca','Tavernes de la Valldigna','Llíria','Burjassot'],
    'Valladolid': ['Valladolid','Laguna de Duero','Arroyo de la Encomienda','Medina del Campo','Peñafiel'],
    'Vizcaya': ['Bilbao','Getxo','Barakaldo','Basauri','Leioa','Santurtzi','Portugalete','Sestao','Galdakao','Durango','Berango','Sopelana','Plentzia','Gorliz'],
    'Zamora': ['Zamora','Benavente'],
    'Zaragoza': ['Zaragoza','Huesca','Calatayud','Ejea de los Caballeros','Tarazona'],
    /* ── USA ── */
    'Florida': [
      'Miami','Miami Beach','Coral Gables','Coconut Grove','Brickell',
      'Key Biscayne','Aventura','Bal Harbour','Sunny Isles Beach','Surfside',
      'Bay Harbor Islands','Fisher Island','Edgewater','Wynwood','Design District',
      'Doral','Hialeah','North Miami Beach','Pinecrest','South Miami'
    ],
  },

  zones: {
    /* ── BARCELONA ── */
    'Barcelona': [
      'Eixample Dret','Eixample Esquerra','Dreta de l\'Eixample','Esquerra de l\'Eixample',
      'Gràcia','Vila de Gràcia','Camp d\'en Grassot','El Putxet','El Coll',
      'Sarrià-Sant Gervasi','Sarrià','Sant Gervasi','La Bonanova','Pedralbes',
      'Les Corts','La Maternitat','La Mercè',
      'El Born','Sant Pere','La Ribera','El Gòtic','Barceloneta','Raval',
      'Poblenou','Diagonal Mar','El Fòrum','Sant Martí','Rambla del Poblenou',
      'Sants','Sants-Badal','Hostafrancs','La Bordeta',
      'Horta-Guinardó','Horta','Carmel','Guinardó',
      'Nou Barris','Vallbona','Vilapicina','Prosperitat',
      'Sant Andreu','Navas','Bon Pastor','Baró de Viver',
      'Vallvidrera','Tibidabo','Les Planes',
      'Montjuïc','Poble Sec'
    ],
    /* ── BARCELONA PROVINCE ── */
    'Sant Cugat del Vallès': [
      'Centre','Casco Antiguo','Mira-sol','Valldoreix','La Floresta','Les Planes',
      'Can Barata','Can Mates','Volpelleres','Golf','Parc Central','Can Magí','Turó de Can Mates'
    ],
    'Sitges': [
      'Centre','Terramar','Aiguadolç','Garraf','Vallpineda','El Vinyet','Les Botigues de Sitges','Canyelles'
    ],
    'Castelldefels': [
      'Centre','Bellamar','El Castell','Residencial Sant Miquel','La Pineda','Can Bou'
    ],
    'Gavà': ['Centre','Gavà Mar','Can Tries','Llobregat','Molí Nou'],
    'Alella': ['Centre','Masnou','El Poblenou d\'Alella','El Turó'],
    /* ── MADRID ── */
    'Madrid': [
      'Salamanca','Recoletos','Goya','Lista','Castellana','Almagro',
      'Chamberí','Trafalgar','Alonso Martínez','Ríos Rosas',
      'Chamartín','El Viso','Hispanoamérica','Nueva España','Prosperidad',
      'Retiro','Ibiza','Jerónimos','Niño Jesús','Pacífico',
      'Centro','Sol','Justicia','Universidad','Palacio','Embajadores',
      'Moncloa-Aravaca','Argüelles','Ciudad Universitaria','Valdezarza','Valdemarín',
      'La Moraleja','El Encinar de los Reyes','Arturo Soria','Ciudad Jardín',
      'Hortaleza','Fuencarral-El Pardo','Carabanchel','Usera','Villaverde',
      'San Blas-Canillejas','Moratalaz','Vicálvaro','Villa de Vallecas'
    ],
    'Pozuelo de Alarcón': ['Centro','La Finca','Somosaguas','Aravaca','El Plantío','Húmera','Pozuelo-Estación'],
    'Majadahonda': ['Centro','El Pinar','Monteclaro','Las Lomas','Majadahonda Sur'],
    'Las Rozas de Madrid': ['Centro','El Carralero','Las Matas','Las Rozas Pueblo','Monte Rozas','El Cantizal'],
    /* ── MÁLAGA ── */
    'Málaga': [
      'Centro Histórico','Soho','El Limonar','Málaga Este','El Palo','Pedregalejos',
      'El Molinillo','Trinidad','Cruz del Humilladero','Churriana','Puerto de la Torre'
    ],
    'Marbella': [
      'Centro','Casco Antiguo','Puerto Banús','Nueva Andalucía','Sierra Blanca',
      'Los Monteros','Elviria','El Rosario','Río Real','La Zagaleta',
      'Guadalmina Alta','Guadalmina Baja','San Pedro de Alcántara','Bel-Air','Cancelada',
      'Los Flamingos','Las Chapas','Cabopino','La Campana'
    ],
    'Estepona': ['Centro','Selwo','Bahía Dorada','Atalaya Park','Las Mesas','El Padróm','Velilla'],
    'Benahavís': ['Benahavis Centro','La Quinta','Los Arqueros','Monte Mayor','Marbella Club Golf','Los Jaralillos'],
    'Nerja': ['Centro','Burriana','Torrecilla','Capistrano','El Capistrano','Maro'],
    'Mijas': ['Las Lagunas','Calahonda','La Cala de Mijas','Mijas Pueblo','El Chaparral'],
    'Fuengirola': ['Centro','Los Boliches','El Boquetillo','Las Lagunas','Torreblanca','Carvajal'],
    'Benalmádena': ['Arroyo de la Miel','Benalmádena Pueblo','Benalmádena Costa','Torremolinos'],
    /* ── ILLES BALEARS ── */
    'Palma': [
      'Centro Histórico','Casco Antiguo','Santa Catalina','El Terreno','Son Vida','Génova',
      'Illetes','Cas Catalá','Portals Nous','Son Espanyolet','La Bonanova',
      'El Molinar','Coll d\'en Rabassa','Son Gual','Establiments','Son Sardina','Indioteria'
    ],
    'Calvià': ['Palma Nova','Magaluf','Santa Ponça','Portals Nous','Costa de la Calma','Peguera','Camp de Mar','Andratx'],
    'Ibiza': ['Dalt Vila','La Marina','Figueretes','Talamanca','Jesús','Can Furnet','Roca Llisa','Sol d\'en Serra','Playa d\'en Bossa'],
    'Santa Eulària des Riu': ['Santa Eulalia','Es Canar','Cala Llenya','Cala Nova','Puig d\'en Valls','Jesús','Siesta'],
    'Sant Antoni de Portmany': ['Sant Antoni Centre','Cala Salada','Cala Bassa','Port des Torrent','San Agustín'],
    'Sant Josep de sa Talaia': ['Es Cubells','Cala Jondal','Es Torrent','Cala Tarida','Cala Vadella','Ses Salines'],
    'Formentera': ['La Savina','Sant Francesc','Es Pujols','Playa Migjorn','La Mola','Cala Saona'],
    'Andratx': ['Puerto de Andratx','Camp de Mar','Andratx Pueblo','S\'Arracó','San Telmo'],
    'Pollença': ['Pollença','Port de Pollença','Formentor'],
    'Sóller': ['Sóller','Port de Sóller','Biniaraix','Fornalutx'],
    /* ── GIRONA / COSTA BRAVA ── */
    'Girona': ['Centre','Eixample','Montilivi','Can Gibert','Salt','Pedret'],
    'Platja d\'Aro': ['Centre','S\'Agaró','Calonge','Castell-Platja d\'Aro'],
    'Cadaqués': ['Centre','Cap de Creus','Portlligat'],
    'Begur': ['Centre','Aiguafreda','Sa Riera','Sa Tuna','Fornells','Pals'],
    'Palafrugell': ['Centre','Calella de Palafrugell','Llafranc','Tamariu'],
    'Roses': ['Centre','Empuriabrava','Santa Margarida','Canyelles Petites'],
    'Lloret de Mar': ['Centre','Fenals','Sa Caleta','Cala Canyelles'],
    /* ── ALICANTE / COSTA BLANCA ── */
    'Alicante': ['Centro','Playa de San Juan','El Campello','Carolinas','Benalúa','San Blas','Vistahermosa'],
    'Benidorm': ['Levante','Poniente','Rincón de Loix','La Cala','Villajoyosa'],
    'Xàbia': ['Centro','El Puerto','Arenal','Cabo La Nao','Balcón al Mar'],
    'Dénia': ['Centro','Las Marinas','Las Rotas','La Xara','Els Poblets'],
    'Calpe': ['Centro','La Manzanera','El Tosal','Costa Norte','La Calalga'],
    'Altea': ['Centro','Altea la Vella','Cap Blanc','Altea Hills','La Olla'],
    'Torrevieja': ['Centro','La Mata','Los Locos','Cabo Cervera','Playa del Cura'],
    /* ── VALENCIA ── */
    'Valencia': [
      'El Carmen','El Pilar','Barrio del Carmen','Ruzafa','Eixample','Gran Vía',
      'Benimaclet','Cabanyal','Canyamelar','Mestalla','Campanar','Exposición',
      'Nou Moles','La Saïdia','Morvedre','Marxalenes','Penya-Roja','El Pla del Remei'
    ],
    'Gandía': ['Centro','Playa de Gandía','Vergel','Les Bovetes'],
    /* ── CÁDIZ / COSTA DE LA LUZ ── */
    'Cádiz': ['Centro Histórico','La Viña','San Carlos','La Caleta','Mentidero','Puntales'],
    'Jerez de la Frontera': ['Centro','San Telmo','Santiago','La Laguna','San Marcos','Chapín'],
    'Sanlúcar de Barrameda': ['Centro','Bajo de Guía','La Jara','Bonanza'],
    'Conil de la Frontera': ['Centro','La Fontanilla','El Colorado','Zahara de los Atunes'],
    /* ── SEVILLA ── */
    'Sevilla': [
      'Santa Cruz','Triana','El Arenal','Nervión','Los Remedios','Macarena',
      'Heliópolis','San Bernardo','Bellavista','Tablada','Torreblanca','Cerro-Amate'
    ],
    /* ── GRANADA / COSTA TROPICAL ── */
    'Granada': ['Albaicín','Centro','Zaidín','Genil','Beiro','Ronda','Realejo'],
    'Almuñécar': ['Centro','La Herradura','Velilla','San Cristóbal','El Majuelo'],
    /* ── CANARIAS ── */
    'Las Palmas de Gran Canaria': ['Vegueta','Triana','Las Canteras','Guanarteme','Ciudad Alta','Schamann'],
    'Maspalomas': ['Playa del Inglés','Campo Internacional','El Tablero','Sonnenland'],
    'Costa Adeje': ['Fañabé','Torviscas','La Caleta','El Duque','Las Américas'],
    'Arona': ['Los Cristianos','Las Galletas','El Palm-Mar','Cabo Blanco'],
    'Puerto de la Cruz': ['Centro','La Paz','Botánico','Playa Jardín','Castillo','La Orotava'],
    /* ── CANTABRIA ── */
    'Santander': ['Centro','El Sardinero','El Alta','Cuatro Caminos','Monte','Cazoña','Nueva Montaña'],
    'Castro-Urdiales': ['Centro','Brazomar','Ostende','El Cotillo'],
    /* ── PAÍS VASCO ── */
    'San Sebastián': ['Centro','Gros','Antiguo','Amara','Intxaurrondo','Egia','Alza','Miraconcha','Ondarreta'],
    'Bilbao': ['Indautxu','Abando','Casco Viejo','Deusto','Begoña','Rekalde','San Ignacio'],
    'Getxo': ['Neguri','Romo','Las Arenas','Algorta','Bidezabal'],
    /* ── ASTURIAS ── */
    'Oviedo': ['Centro','El Cristo','La Florida','Buenavista','Pumarín','San Lázaro'],
    'Gijón': ['Centro','La Calzada','El Natahoyo','Somió','La Arena','El Bibio'],
    /* ── MURCIA ── */
    'Murcia': ['Centro','La Flota','El Carmen','Vista Alegre','El Palmar','Santa María de Gracia'],
    'Cartagena': ['Centro','Los Dolores','Cartagena Puerto','El Algar','La Manga del Mar Menor'],
    /* ── TARRAGONA / COSTA DAURADA ── */
    'Salou': ['Centro','Cap Salou','Cala Font','La Pineda'],
    'Cambrils': ['Centro','Cap de Sant Pere','Cambrils Port','Vilafortuny'],
    'Tarragona': ['Centro','Part Alta','Eixample','Torreforta','Bonavista'],
    /* ── FLORIDA / MIAMI ── */
    'Miami': [
      'Brickell','Downtown Miami','Coconut Grove','Coral Gables','Little Havana',
      'Little Haiti','Wynwood','Design District','Edgewater','Midtown','Allapattah',
      'Upper East Side','Buena Vista','Flagami','West Flagler','Overtown'
    ],
    'Miami Beach': [
      'South Beach','Mid-Beach','North Beach','Venetian Islands','Sunset Islands',
      'Nautilus','La Gorce','Bay Road','Normandy Isles','North Shore'
    ],
    'Coral Gables': [
      'Country Club Pines','Crafts Section','Golden Gate','Brickell Station',
      'Old Cutler Road','Coconut Grove North','Riviera'
    ],
    'Brickell': [
      'Brickell Key','East Brickell','West Brickell','Brickell Heights','Mary Brickell Village'
    ],
    'Coconut Grove': [
      'North Coconut Grove','South Coconut Grove','Silver Bluff','Peacock Park'
    ],
    'Key Biscayne': ['Crandon Park','Village of Key Biscayne','Bill Baggs'],
    'Aventura': ['Aventura Mall Area','Turnberry','Williams Island','Golden Beach'],
    'Sunny Isles Beach': ['Trump Towers Area','Acqualina','Jade Beach','Portofino Tower'],
    'Bal Harbour': ['Bal Harbour Village','Bal Harbour Shops Area'],
    'Surfside': ['Surfside Oceanfront','Surfside Town Center'],
    'Edgewater': ['Aria on the Bay','One Paraiso','Elysee'],
    'Wynwood': ['Wynwood Walls','Wynwood North','Wynwood South'],
    'Design District': ['Moore Building Area','Palm Court','NE 2nd Ave'],
    'Doral': ['Downtown Doral','CityPlace Doral','Doral Isles'],
    'Fisher Island': ['Fisher Island Drive'],
  }
}
