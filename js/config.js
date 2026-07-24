// ==================== DATA (carregado do Google Sheets) ====================
var DB = { cadastro: [], manutRealizada: [], manutProgramada: [], maquinas: [], maqLocalizacao: [], maqAbastecimento: [], maqManutencao: [], tanques: [], tanqueEntradas: [], frequencia: [] };
var BASE = { motoristas: [], localCarga: [], localDescarga: [], placas: [], localAbast: [], classeDesp: [], tipoManut: [], clientesM3: [] };
var LOCAIS_DATA = [];
var MOTORISTAS_DATA = [];
var CAMINHOES_DATA = [];
var USUARIOS = [];
var currentUser = null;
var currentUserData = null;
var chartInstances = {};
var API_URL = 'https://script.google.com/macros/s/AKfycbwCp2fQrVL62TTZfSOzDfGhPHIj3nabLayyrN1ljQ8RYH-TqpsithKX_e1Bw6dQHJFd5A/exec';
var dataLoaded = false;

