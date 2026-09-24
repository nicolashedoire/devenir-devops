#!/usr/bin/env node
// Modifie seulement une déclaration Git locale : aucun push ni accès au cluster.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './kube-common.mjs';
const [environment, referenceFile] = process.argv.slice(2);
if (!['recette', 'production'].includes(environment) || !referenceFile) throw new Error('Usage : node scripts/promote-image.mjs recette|production <reference-image.json>');
const reference = JSON.parse(await readFile(path.resolve(root, referenceFile)));
if (reference.repository !== 'ghcr.io/nicolashedoire/devenir-devops' || !/^sha256:[a-f0-9]{64}$/.test(reference.digest) || !/^[a-f0-9]{40}$/.test(reference.revision)) throw new Error('La référence doit contenir le dépôt, le digest et le commit source attendus.');
if (!Array.isArray(reference.architectures) || !['amd64','arm64'].every(a => reference.architectures.includes(a))) throw new Error('Le laboratoire exige les deux architectures.');
const target = path.join(root, `deploy/gitops/environments/${environment}/values.yaml`);
const current = await readFile(target, 'utf8');
const pattern = /^  digest: sha256:[a-f0-9]{64}$/gm;
if ((current.match(pattern) || []).length !== 1) throw new Error('Structure du fichier de valeurs inattendue ; modifier le fichier après relecture.');
await writeFile(target, current.replace(pattern, `  digest: ${reference.digest}`));
console.log(`Déclaration ${environment} mise à jour localement. Relire git diff, créer un commit puis pousser votre branche. Le script ne prouve pas, à lui seul, que l’image a été testée : consulter la preuve de publication.`);
