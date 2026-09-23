/**
 * Adaptador de Armazenamento para Consulta Pública (GitHub Pages).
 * Fornece a interface ProforStore em modo estritamente somente leitura,
 * carregando diretamente o snapshot embutido em window.PROFOR_PUBLIC_DATA.
 * Elimina chamadas HTTP para o servidor local e permite funcionamento sob file:// e GitHub Pages.
 */
(function(root){
  'use strict';

  async function open(){
    return read('current');
  }

  async function read(key='current'){
    const state = root.PROFOR_PUBLIC_DATA;
    if(!state) throw new Error('Base de dados pública não localizada.');
    if(key === 'current') return state;
    return null;
  }

  async function save(){
    throw new Error('Ambiente de consulta pública (somente leitura).');
  }

  async function legacy(){
    return null;
  }

  root.ProforStore = { open, read, save, legacy };
})(globalThis);
