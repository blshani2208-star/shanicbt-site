#!/usr/bin/env python3
"""Prepare an offline candidate from the exact inspected live files; never deploy."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Directory containing the current index.html and privacy.html')
    parser.add_argument('output', type=Path, help='New, non-existing candidate directory')
    args = parser.parse_args()
    review = Path(__file__).resolve().parents[1] / 'review'
    manifest = json.loads((review / 'contact-manifest.json').read_text())
    pairs = [('index.html', 'live'), ('privacy.html', 'privacy')]
    for filename, key in pairs:
        source = args.source / filename
        if not source.is_file() or digest(source) != manifest[key + '_original_sha256']:
            parser.error(f'{filename} differs from the inspected version. Review the new source; no candidate created.')
    if args.output.exists():
        parser.error('Output already exists; choose a new directory.')
    args.output.mkdir(parents=True)
    for filename, _ in pairs:
        shutil.copyfile(args.source / filename, args.output / filename)
    for patch in ['live-contact.patch', 'live-privacy.patch']:
        command = ['git', 'apply', str(review / patch)]
        subprocess.run(command[:2] + ['--check'] + command[2:], cwd=args.output, check=True)
        subprocess.run(command, cwd=args.output, check=True)
    for filename, key in pairs:
        if digest(args.output / filename) != manifest[key + '_candidate_sha256']:
            raise SystemExit(f'{filename}: candidate hash mismatch. Do not deploy this directory.')
    print(f'Prepared {args.output.resolve()}; no deployment performed. Keep all other site assets unchanged.')


if __name__ == '__main__':
    main()
