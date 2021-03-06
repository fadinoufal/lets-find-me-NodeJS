
module.exports = (sequelize, DataTypes) => {
  let Address = sequelize.define("address", {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4()
    },
    street: DataTypes.STRING,
    city: DataTypes.STRING,
    country: DataTypes.STRING,
    lat: DataTypes.STRING,
    lang: DataTypes.STRING,
    postcode: DataTypes.INTEGER
  });

  return Address;
};
