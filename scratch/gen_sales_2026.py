import csv
import random
from datetime import datetime, timedelta

products = [
    ("KL-IS-001", "Iron Sheet - Blue 0.5mm", 12000),
    ("KL-IS-002", "Iron Sheet - Red 0.4mm", 10500),
    ("KL-IS-003", "Iron Sheet - Green 0.5mm", 12500),
    ("KL-IS-004", "Iron Sheet - Charcoal 0.5mm", 13000),
    ("KL-IS-005", "Iron Sheet - Tile Profile 0.5mm", 14500),
    ("KL-MC-150", "Kinglion Motorcycle - Model 150", 1250000),
    ("KL-MC-200", "Kinglion Motorcycle - Model 200", 1500000),
    ("KL-MC-250", "Kinglion Motorcycle - Cargo Special", 1850000),
]

customers = [
    "Kigali Construction Ltd", "Rubavu Hardware", "Musanze Builders", "Huye Traders",
    "City Delivery Services", "Rwanda Logistics", "Lake Kivu Transport", "Eastern Supplies",
    "Nyagatare Contractors", "Gicumbi Wholesalers", "Rusizi Engineering", "Bugesera Estate"
]

regions = ["Kigali", "Eastern", "Western", "Northern", "Southern"]

# FIXED: Use 2026 dates to match current system time
now = datetime(2026, 4, 25)
start_date = now - timedelta(days=60) # Last 60 days
data = []

for i in range(150):
    date = start_date + timedelta(days=random.randint(0, 60))
    sku, name, price = random.choice(products)
    qty = random.randint(10, 100) if "Iron" in name else random.randint(1, 10)
    customer = random.choice(customers)
    region = random.choice(regions)
    data.append([date.strftime("%Y-%m-%d"), sku, name, qty, price, customer, region])

# Sort by date
data.sort(key=lambda x: x[0])

with open('C:/Users/NGOBOKAE/Desktop/Project/frontend/frontend/public/sales_template.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(["Date", "Product SKU", "Product Name", "Quantity", "Unit Price", "Customer Name", "Region"])
    writer.writerows(data)

print(f"Generated 150 current rows (2026) in public/sales_template.csv")
