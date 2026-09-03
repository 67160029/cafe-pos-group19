class OrderItem {
  constructor(name, price, quantity) {
    this.name = name;
    this.price = price;
    this.quantity = quantity;
  }

  calculateSubtotal() {
    return this.price * this.quantity;
  }
}

module.exports = OrderItem;
