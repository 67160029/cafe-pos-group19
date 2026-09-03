class Order {
  constructor(orderId = null, paymentMethod) {
    this.orderId = orderId;
    this.paymentMethod = paymentMethod;
    this.items = [];
    this.totalAmount = 0;
    this.createdAt = new Date();
  }

  addItem(item) {
    this.items.push(item);
    this.calculateTotal();
  }

  removeItem(index) {
    this.items.splice(index, 1);
    this.calculateTotal();
  }

  calculateTotal() {
    this.totalAmount = this.items.reduce(
      (sum, item) => sum + item.calculateSubtotal(),
      0,
    );

    return this.totalAmount;
  }
}

module.exports = Order;
