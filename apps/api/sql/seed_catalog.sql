WITH catalog(segment, name, description, price, image_url, stock_quantity) AS (
  VALUES
    ('food', 'Arepa reina pepiada', 'Arepa de maíz rellena de pollo, aguacate y salsa de la casa.', 5.50, 'https://images.unsplash.com/photo-1628797954631-6f7a460ab5af?auto=format&fit=crop&w=800&q=80', 20),
    ('food', 'Cachapa con queso', 'Cachapa de maíz dulce con queso de mano.', 7.00, 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=800&q=80', 15),
    ('food', 'Hamburguesa clásica', 'Carne a la plancha, queso, vegetales frescos y papas.', 8.90, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80', 12),
    ('food', 'Pabellón criollo', 'Carne mechada, caraotas, arroz, tajadas y queso.', 9.50, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&q=80', 10),
    ('food', 'Jugo natural de parchita', 'Jugo natural preparado al momento, 400 ml.', 2.50, 'https://images.unsplash.com/photo-1622597467836-f3285f2131b8?auto=format&fit=crop&w=800&q=80', 30),
    ('food', 'Tres leches', 'Porción individual de torta tres leches.', 4.00, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=800&q=80', 8),
    ('grocery', 'Harina de maíz precocida', 'Paquete de harina de maíz precocida, 1 kg.', 2.30, 'https://images.unsplash.com/photo-1601593768798-3f443a96d7b6?auto=format&fit=crop&w=800&q=80', 25),
    ('grocery', 'Leche UHT', 'Leche entera de larga duración, 1 litro.', 1.80, 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=800&q=80', 18),
    ('grocery', 'Huevos (docena)', 'Docena de huevos frescos seleccionados.', 3.60, 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&w=800&q=80', 12),
    ('grocery', 'Arroz blanco', 'Arroz blanco de grano largo, 1 kg.', 1.60, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=80', 22),
    ('grocery', 'Aceite vegetal', 'Aceite vegetal comestible, 900 ml.', 3.20, 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=800&q=80', 10),
    ('grocery', 'Cambur por kilo', 'Cambur fresco de producción local, 1 kg.', 1.40, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80', 16),
    ('pharmacy', 'Acetaminofén 500 mg', 'Caja de 10 tabletas. Usar según indicación del empaque.', 2.40, 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=800&q=80', 20),
    ('pharmacy', 'Suero oral', 'Solución de rehidratación oral, sabor neutro, 500 ml.', 1.90, 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?auto=format&fit=crop&w=800&q=80', 15),
    ('pharmacy', 'Alcohol antiséptico', 'Alcohol antiséptico para uso externo, 250 ml.', 2.10, 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80', 14),
    ('pharmacy', 'Mascarillas desechables', 'Paquete de 10 mascarillas de uso personal.', 2.80, 'https://images.unsplash.com/photo-1584634731339-252c581abfc5?auto=format&fit=crop&w=800&q=80', 25),
    ('pharmacy', 'Vitamina C 1 g', 'Tabletas efervescentes, tubo de 10 unidades.', 3.50, 'https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=800&q=80', 12),
    ('pharmacy', 'Protector solar FPS 50', 'Protector solar de amplio espectro, 100 ml.', 12.00, 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=800&q=80', 7),
    ('parts', 'Aceite de motor 20W-50', 'Lubricante mineral para motor, envase de 1 litro.', 8.50, 'https://images.unsplash.com/photo-1635784063381-184d56f9c9b9?auto=format&fit=crop&w=800&q=80', 10),
    ('parts', 'Filtro de aceite universal', 'Filtro de aceite compatible con modelos seleccionados.', 6.00, 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80', 8),
    ('parts', 'Bujía estándar', 'Bujía para vehículos seleccionados. Verificar compatibilidad.', 4.25, 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80', 18),
    ('parts', 'Refrigerante concentrado', 'Refrigerante para sistema de enfriamiento, 1 litro.', 5.75, 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80', 9),
    ('parts', 'Kit de herramientas básico', 'Juego compacto de herramientas para mantenimiento.', 15.00, 'https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?auto=format&fit=crop&w=800&q=80', 5),
    ('parts', 'Limpiaparabrisas universal', 'Par de limpiaparabrisas de 16 pulgadas.', 9.00, 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80', 6)
),
store_segments AS (
  SELECT s.id,
    CASE
      WHEN LOWER(c.name) IN ('restaurantes', 'cafeterías', 'comidas') THEN 'food'
      WHEN LOWER(c.name) IN ('supermercados', 'bodegas') THEN 'grocery'
      WHEN LOWER(c.name) IN ('farmacias', 'farmacia') THEN 'pharmacy'
      WHEN LOWER(c.name) IN ('tiendas', 'repuestos') THEN 'parts'
      ELSE 'grocery'
    END AS segment
  FROM stores s
  LEFT JOIN categories c ON c.id = s.category_id
  WHERE s.active = TRUE
)
INSERT INTO products(store_id, name, description, price, image_url, stock_quantity, in_stock)
SELECT ss.id, catalog.name, catalog.description, catalog.price, catalog.image_url, catalog.stock_quantity, TRUE
FROM store_segments ss
JOIN catalog ON catalog.segment = ss.segment
WHERE NOT EXISTS (
  SELECT 1 FROM products existing
  WHERE existing.store_id = ss.id AND existing.name = catalog.name
);
