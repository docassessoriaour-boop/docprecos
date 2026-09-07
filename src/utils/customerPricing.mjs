const money = value => {
  const number = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

export const CUSTOMER_PRICING_INSTRUCTIONS = `Preços diferenciados: extraia UMA oferta com regularPrice (preço normal), specialPrice (preço exclusivo de clube/cliente cadastrado), specialCondition (nome do clube e condição impressa) e specialOnly (true apenas se só há preço exclusivo e nenhum preço normal legível). O campo price deve conter regularPrice quando existir, senão specialPrice. Não trate preço exclusivo como disponível para todos. Exemplo: músculo R$39,90 normal e R$32,98 exclusivo Clube+ Família: price 39.90, regularPrice 39.90, specialPrice 32.98, specialCondition "Clube+ Família", specialOnly false. Sem desconto de cliente, omita specialPrice. Não classifique atacado, quantidade mínima, parcelamento ou preço unitário de pack como preço de clube. Preserve essas condições no nome e nunca invente preços ou condições.`;

export function readCustomerPrices(item) {
  const regularPrice = money(item.regularPrice);
  const specialPrice = money(item.specialPrice);
  return {
    ...(regularPrice ? { regularPrice } : {}),
    ...(specialPrice ? { specialPrice } : {}),
    specialOnly: item.specialOnly === true && !regularPrice,
    specialCondition: String(item.specialCondition || '').trim(),
  };
}

export function resolveCustomerPrice(product, eligible) {
  const normal = product.regularPrice || (product.specialOnly ? undefined : product.price);
  const special = product.specialPrice;
  if (eligible && special > 0 && (!normal || special < normal)) {
    return { ...product, price: special, priceTier: 'special' };
  }
  return normal > 0 ? { ...product, price: normal, priceTier: 'regular' } : null;
}
