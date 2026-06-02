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

start_date = datetime(2023, 1, 1)
data = []

for i in range(100):
    date = start_date + timedelta(days=random.randint(0, 480))
    sku, name, price = random.choice(products)
    qty = random.randint(1, 100) if "Iron" in name else random.randint(1, 10)
    customer = random.choice(customers)
    region = random.choice(regions)
    data.append([date.strftime("%Y-%m-%d"), sku, name, qty, price, customer, region])

# Sort by date
data.sort(key=lambda x: x[0])

with open('C:/Users/NGOBOKAE/Desktop/Project/frontend/frontend/public/sales_template.csv', 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(["Date", "Product SKU", "Product Name", "Quantity", "Unit Price", "Customer Name", "Region"])
    writer.writerows(data)

print(f"Generated 100 rows in public/sales_template.csv")
