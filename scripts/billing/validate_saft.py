"""Validate an accounting system's SAF-T (AO) XML against a trusted local AGT XSD."""
import argparse
from pathlib import Path

from lxml import etree


def validate(document: Path, schema: Path) -> None:
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False)
    tree = etree.parse(str(document), parser)
    if tree.docinfo.doctype:
        raise ValueError("DTD não permitido")
    validator = etree.XMLSchema(etree.parse(str(schema), parser))
    validator.assertValid(tree)


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("xml", type=Path)
    cli.add_argument("xsd", type=Path)
    args = cli.parse_args()
    try:
        validate(args.xml, args.xsd)
    except (OSError, ValueError, etree.LxmlError) as error:
        cli.exit(1, f"Validação falhou: {error}\n")
    print("XML conforme ao XSD fornecido.")
