// Bibliothèque de connexion directe entre navigateurs (WebRTC), chargée à la demande par
// src/moulin2/10-net.js. Trystero (licence MIT) : les joueurs se trouvent par des relais publics
// (réseau Nostr), puis se parlent directement, sans serveur à nous.
import { joinRoom, getRelaySockets, defaultRelayUrls } from "trystero";

globalThis.MoulinP2P = { joinRoom, getRelaySockets, defaultRelayUrls };
