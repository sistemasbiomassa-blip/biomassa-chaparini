// ==================== DATA (carregado do Google Sheets) ====================
var DB = { cadastro: [], manutRealizada: [], manutProgramada: [], garantiaCaminhoes: [], manutProgramadaGarantia: [], manutPneusItens: [], maquinas: [], maqLocalizacao: [], maqAbastecimento: [], maqManutencao: [], tanques: [], tanqueEntradas: [], frequencia: [], alertas: [] };
var BASE = { motoristas: [], localCarga: [], localDescarga: [], placas: [], localAbast: [], classeDesp: [], tipoManut: [], clientesM3: [] };
var LOCAIS_DATA = [];
var MOTORISTAS_DATA = [];
var CAMINHOES_DATA = [];
var USUARIOS = [];
var currentUser = null;
var currentUserData = null;
var chartInstances = {};
var API_URL = 'https://script.google.com/macros/s/AKfycbwCp2fQrVL62TTZfSOzDfGhPHIj3nabLayyrN1ljQ8RYH-TqpsithKX_e1Bw6dQHJFd5A/exec'; // legado (Google Sheets) - mantido só para referência/rollback
var dataLoaded = false;

// ==================== SUPABASE ====================
// Chave "anon" é pública por design (protegida pelas políticas de RLS no banco) — segura para expor no front.
var SUPABASE_URL = 'https://lmkmntkqdlsrajdnyclr.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxta21udGtxZGxzcmFqZG55Y2xyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3ODUwOTcsImV4cCI6MjEwMTM2MTA5N30.62lKEay_4qr0rMoZBXwUnbi06oxm4ICNARtrhvrtJ3E';
var sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

