/**
 * Dados de desenvolvimento: referências de honorários para testar o
 * comparativo da calculadora.
 *
 *   npm run db:semear
 *
 * ATENÇÃO: os valores são ILUSTRATIVOS (ilustrativo = true). Antes de ir para
 * produção, importe a tabela vigente de cada seccional (o site de cada OAB/UF
 * publica a sua) e grave ilustrativo = false com o link oficial em fonte_url.
 */
try {
  process.loadEnvFile(".env.local");
} catch {
  // usa DATABASE_URL do ambiente
}

const { pool } = await import("@/db");

try {
  const { rowCount } = await pool.query(`
    insert into oab_fee_references
      (uf, area, servico, valor_minimo_cents, percentual_minimo, observacao, fonte_url, vigencia, ilustrativo)
    values
      ('SP', 'civel', 'Ação de procedimento comum', 600000, 20.00, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'civel', 'Execução de título extrajudicial', 450000, 10.00, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'consumidor', 'Ação no Juizado Especial Cível', 250000, 20.00, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'familia', 'Divórcio consensual', 500000, null, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'familia', 'Ação de alimentos', 400000, null, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'trabalhista', 'Reclamação trabalhista (reclamante)', null, 20.00, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'trabalhista', 'Defesa trabalhista (reclamada)', 500000, null, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'empresarial', 'Elaboração de contrato social', 300000, null, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'contratos', 'Elaboração ou revisão de contrato', 200000, null, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'tributario', 'Mandado de segurança tributário', 700000, 10.00, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'criminal', 'Defesa em ação penal (rito ordinário)', 1200000, null, 'Valor ilustrativo para testes', null, 'exemplo', true),
      ('SP', 'previdenciario', 'Ação de concessão de benefício', null, 20.00, 'Valor ilustrativo para testes', null, 'exemplo', true)
    on conflict (uf, area, servico) do nothing`);
  console.log(`Referências da OAB (ilustrativas): ${rowCount} inseridas.`);
} finally {
  await pool.end();
}
