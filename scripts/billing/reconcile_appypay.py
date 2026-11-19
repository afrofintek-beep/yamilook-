"""Reconcile one pre-bound AppyPay sandbox charge, using merchant-scoped credentials."""
import argparse
import json
import os
from decimal import Decimal
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from uuid import UUID


def reconcile(charge_id: UUID) -> None:
    root = os.environ["BILLING_SANDBOX_SUPABASE_URL"].rstrip("/")
    if urlparse(root).scheme != "https":
        raise ValueError("HTTPS obrigatório")
    merchant = os.environ["APPYPAY_SANDBOX_MERCHANT"]
    token = os.environ["APPYPAY_SANDBOX_TOKEN"]
    key = os.environ["BILLING_SANDBOX_SERVICE_KEY"]
    request = Request(f"https://gwy-api-tst.appypay.co.ao/v2.0/charges/{charge_id}",
                      headers={"Authorization": f"Bearer {token}"})
    with urlopen(request, timeout=15) as response:
        charge = json.load(response, parse_float=Decimal)
    status = charge["responseStatus"]
    if UUID(charge["id"]) != charge_id or status.get("successful") is not True or status.get("status") != "Success":
        raise ValueError("Cobrança por confirmar")
    cents = Decimal(str(charge["amount"])) * 100
    if cents <= 0 or cents != cents.to_integral_value() or charge.get("currency") != "AOA":
        raise ValueError("Valor ou moeda por confirmar")
    payload = {"p_provider": "appypay", "p_merchant": merchant, "p_order": str(charge_id),
               "p_cents": int(cents), "p_currency": "AOA"}
    rpc = Request(root + "/rest/v1/rpc/billing_pilot_confirm_collection",
                  data=json.dumps(payload).encode(), headers={"apikey": key, "Authorization": f"Bearer {key}",
                  "Content-Type": "application/json"})
    with urlopen(rpc, timeout=15) as response:
        print("Recebimento de teste confirmado", json.load(response))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("charge_id", type=UUID)
    reconcile(parser.parse_args().charge_id)
