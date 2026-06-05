#!/usr/bin/env node
// Popula o banco com dados iniciais (usuários, salões, mesas e cardápio padrão)
// Execute: node backend/db/seed.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const { query, connectDB } = require('../src/config/database');

const BCRYPT_ROUNDS = 12;

const usuarios = [
  { email: 'dono@navarros.beer',    senha: 'admin123',   nome: 'João Navarro', role: 'dono',   avatar: '👑' },
  { email: 'garcom@navarros.beer',  senha: 'garcom123',  nome: 'Carlos Garçom', role: 'garcom', avatar: '🍺' },
  { email: 'garcom2@navarros.beer', senha: 'garcom456',  nome: 'Ana Garçom',   role: 'garcom', avatar: '🍺' },
];

const saloes = ['Salão Interno', 'Varanda', 'Área Externa'];

const mesas = [
  { nome: 'Mesa 01', salao: 'Salão Interno' },
  { nome: 'Mesa 02', salao: 'Salão Interno' },
  { nome: 'Mesa 03', salao: 'Salão Interno' },
  { nome: 'Mesa 04', salao: 'Salão Interno' },
  { nome: 'Mesa 05', salao: 'Varanda' },
  { nome: 'Mesa 06', salao: 'Varanda' },
  { nome: 'Mesa 07', salao: 'Área Externa' },
  { nome: 'Mesa 08', salao: 'Área Externa' },
];

const cardapio = [
  { id: 'c1', categoria: 'Cervejas', nome: 'Brahma 600ml',       preco: 14.90, precoDelivery: 15.90, descricao: 'Cerveja pilsen gelada',           estoque: 60,  estoqueMin: 12 },
  { id: 'c2', categoria: 'Cervejas', nome: 'Heineken 600ml',     preco: 18.90, precoDelivery: 19.90, descricao: 'Cerveja lager holandesa',          estoque: 40,  estoqueMin: 10 },
  { id: 'c3', categoria: 'Cervejas', nome: 'Colorado Appia',     preco: 22.00, precoDelivery: 23.50, descricao: 'Cerveja artesanal com mel',        estoque: 8,   estoqueMin: 10 },
  { id: 'c4', categoria: 'Cervejas', nome: 'Skol Lata 350ml',    preco: 7.90,  precoDelivery: 8.50,  descricao: 'Cerveja pilsen gelada',            estoque: 120, estoqueMin: 24 },
  { id: 'p1', categoria: 'Petiscos', nome: 'Frango à Passarinho', preco: 39.90, precoDelivery: 44.90, descricao: 'Porção de frango frito, 500g',   estoque: 20,  estoqueMin: 5  },
  { id: 'p2', categoria: 'Petiscos', nome: 'Batata Frita',        preco: 24.90, precoDelivery: 27.90, descricao: 'Porção grande com molho especial',estoque: 30,  estoqueMin: 8  },
  { id: 'p3', categoria: 'Petiscos', nome: 'Calabresa Acebolada', preco: 34.90, precoDelivery: 38.90, descricao: 'Linguiça grelhada com cebola',   estoque: 4,   estoqueMin: 5  },
  { id: 'p4', categoria: 'Petiscos', nome: 'Porção Mista',        preco: 54.90, precoDelivery: 59.90, descricao: 'Frango, calabresa e batata frita',estoque: 15,  estoqueMin: 4  },
  { id: 'd1', categoria: 'Drinks',   nome: 'Caipirinha',          preco: 19.90, precoDelivery: 21.90, descricao: 'Limão, cachaça e açúcar',        estoque: 50,  estoqueMin: 10 },
  { id: 'd2', categoria: 'Drinks',   nome: 'Caipiroska',          preco: 21.90, precoDelivery: 23.90, descricao: 'Limão, vodka e açúcar',          estoque: 50,  estoqueMin: 10 },
  { id: 'd3', categoria: 'Drinks',   nome: 'Long Island',         preco: 29.90, precoDelivery: 32.90, descricao: 'Mix de destilados com cola',     estoque: 50,  estoqueMin: 8  },
  { id: 'n1', categoria: 'Não Alcoólicos', nome: 'Refrigerante Lata',  preco: 8.90,  precoDelivery: 9.90,  descricao: 'Coca, Pepsi, Guaraná, Sprite',estoque: 80,  estoqueMin: 20 },
  { id: 'n2', categoria: 'Não Alcoólicos', nome: 'Água Mineral 500ml', preco: 5.90,  precoDelivery: 6.90,  descricao: 'Com ou sem gás',               estoque: 100, estoqueMin: 24 },
  { id: 'n3', categoria: 'Não Alcoólicos', nome: 'Suco Natural',       preco: 12.90, precoDelivery: 14.90, descricao: 'Laranja, maracujá ou limão',   estoque: 25,  estoqueMin: 6  },
];

async function seed() {
  await connectDB();

  console.log('\n[SEED] Iniciando população do banco...\n');

  // Usuários
  for (const u of usuarios) {
    const hash = await bcrypt.hash(u.senha, BCRYPT_ROUNDS);
    await query(
      `INSERT INTO users (email, senha_hash, nome, role, avatar)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO UPDATE SET senha_hash=$2, nome=$3, role=$4, avatar=$5`,
      [u.email, hash, u.nome, u.role, u.avatar]
    );
    console.log(`  ✓ Usuário: ${u.email} (${u.role})`);
  }

  // Salões
  for (const s of saloes) {
    await query('INSERT INTO saloes (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING', [s]);
    console.log(`  ✓ Salão: ${s}`);
  }

  // Mesas + estado inicial
  for (const m of mesas) {
    const { rows } = await query(
      `INSERT INTO mesas (nome, salao) VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING id`,
      [m.nome, m.salao]
    );
    if (rows.length) {
      await query(
        'INSERT INTO estado_mesas (mesa_id, status) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [rows[0].id, 'livre']
      );
      console.log(`  ✓ Mesa: ${m.nome} (${m.salao})`);
    }
  }

  // Cardápio
  for (const p of cardapio) {
    await query(
      `INSERT INTO produtos (id, categoria, nome, preco, preco_delivery, descricao, estoque, estoque_min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         categoria=$2, nome=$3, preco=$4, preco_delivery=$5, descricao=$6`,
      [p.id, p.categoria, p.nome, p.preco, p.precoDelivery, p.descricao, p.estoque, p.estoqueMin]
    );
    console.log(`  ✓ Produto: ${p.nome}`);
  }

  console.log('\n[SEED] Concluído com sucesso!\n');
  console.log('⚠️  ATENÇÃO: Troque as senhas padrão antes de subir em produção!');
  console.log('   Use: POST /api/auth/alterar-senha\n');
  process.exit(0);
}

seed().catch((err) => {
  console.error('[SEED] Erro:', err.message);
  process.exit(1);
});
